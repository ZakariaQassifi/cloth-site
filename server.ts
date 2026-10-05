import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  INVALID_CREDENTIALS,
  MISSING_CREDENTIALS,
  TOO_MANY_ATTEMPTS,
} from './shared/adminAuthMessages';
import { warnIfUnconfigured } from './server/emailConfig';
import { assertSigningSecretIsSafe } from './server/adminAuth';
import { configureSqlite, prisma } from './server/db';
import { hashPassword } from './server/adminPassword';
import {
  authenticateAdmin,
  clearLoginFailures,
  loginRetryAfterSeconds,
  recordLoginFailure,
  requireAdmin,
  signAdminToken,
  touchAdminLogin,
  type AdminRequest,
} from './server/adminAuth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (allowedOrigins.length === 0 && process.env.NODE_ENV === 'production') {
  console.warn(
    '\n⚠️  CORS_ORIGINS is not set, so any website may call this API from a browser.\n' +
      '   Set CORS_ORIGINS to the storefront domain, e.g. CORS_ORIGINS=https://shop.example.com\n'
  );
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: false,
  })
);

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (allowedOrigins.length === 0 || !origin || allowedOrigins.includes(origin)) {
    return next();
  }
  return sendResponse(res, 403, false, 'Origin not allowed');
});

app.use(express.json());

// Ensure uploads dir exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use('/uploads', express.static(uploadDir));

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = MIME_EXTENSIONS[file.mimetype] ?? '.bin';
    cb(null, 'prod-' + uniqueSuffix + ext);
  },
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (MIME_EXTENSIONS[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error('Invalid image format. Please upload JPG, PNG or WebP.'));
  }
};

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

const sendResponse = (
  res: Response,
  statusCode: number,
  success: boolean,
  message: string,
  data?: unknown
) => {
  return res.status(statusCode).json({
    success,
    message,
    ...(data !== undefined && { data }),
  });
};

// ----------------------------------------------------
// SETUP ADMIN ENDPOINT (EMERGENCY / INITIAL SEED)
// ----------------------------------------------------
app.get('/api/setup-admin', async (_req: Request, res: Response) => {
  try {
    const email = (process.env.ADMIN_EMAIL || 'admin@kinetic.com').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const passwordHash = await hashPassword(password);

    const admin = await prisma.adminUser.upsert({
      where: { email },
      update: { passwordHash },
      create: {
        email,
        name: 'Admin',
        passwordHash,
        role: 'ADMIN',
      },
    });

    return sendResponse(res, 200, true, 'Admin account configured successfully!', {
      email: admin.email,
    });
  } catch (error: unknown) {
    return sendResponse(res, 500, false, errorMessage(error, 'Failed to setup admin account'));
  }
});

// ----------------------------------------------------
// HEALTH CHECK
// ----------------------------------------------------
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return sendResponse(res, 200, true, 'API and database are reachable', {
      database: 'connected',
      uptimeSeconds: Math.round(process.uptime()),
    });
  } catch (error: unknown) {
    return sendResponse(res, 503, false, errorMessage(error, 'Database unreachable'));
  }
});

// ----------------------------------------------------
// ADMIN AUTHENTICATION
// ----------------------------------------------------
const loginThrottleKey = (req: Request): string => req.ip || req.socket.remoteAddress || 'unknown';

app.post('/api/admin/login', async (req: Request, res: Response) => {
  const throttleKey = loginThrottleKey(req);

  if (loginRetryAfterSeconds(throttleKey) > 0) {
    res.setHeader('Retry-After', String(loginRetryAfterSeconds(throttleKey)));
    return sendResponse(res, 429, false, TOO_MANY_ATTEMPTS);
  }

  const { email, password } = (req.body ?? {}) as { email?: unknown; password?: unknown };

  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return sendResponse(res, 400, false, MISSING_CREDENTIALS);
  }

  try {
    const { admin } = await authenticateAdmin(email, password);

    if (!admin) {
      recordLoginFailure(throttleKey);
      return sendResponse(res, 401, false, INVALID_CREDENTIALS);
    }

    clearLoginFailures(throttleKey);
    void touchAdminLogin(admin.adminId);

    const token = signAdminToken({
      sub: admin.adminId,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    });

    return sendResponse(res, 200, true, 'Admin login successful', {
      token,
      admin: { id: admin.adminId, email: admin.email, name: admin.name, role: admin.role },
    });
  } catch (error: unknown) {
    return sendResponse(res, 500, false, errorMessage(error, 'Unable to sign in right now.'));
  }
});

app.get('/api/admin/me', requireAdmin, (req: AdminRequest, res: Response) => {
  const admin = req.admin;
  return sendResponse(res, 200, true, 'Authenticated', {
    admin: admin
      ? { id: admin.adminId, email: admin.email, name: admin.name, role: admin.role }
      : null,
  });
});

app.post('/api/admin/logout', requireAdmin, (_req: Request, res: Response) => {
  return sendResponse(res, 200, true, 'Signed out');
});

// ----------------------------------------------------
// SERVE FRONTEND (STATIC SPA FALLBACK)
// ----------------------------------------------------
const distPath = path.join(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    return res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ----------------------------------------------------
// START SERVER
// ----------------------------------------------------
async function startServer() {
  try {
    await configureSqlite();
    assertSigningSecretIsSafe();
    warnIfUnconfigured();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();