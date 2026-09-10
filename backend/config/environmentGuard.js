/**
 * Environment Separation and Startup Security Guard
 * Prevents cross-environment data leakage, accidental production targeting, and secret exposure.
 */

class EnvironmentGuard {
  constructor() {
    this.env = process.env.NODE_ENV || 'development';
  }

  /**
   * Validate current runtime environment parameters
   */
  validateEnvironment() {
    const isProduction = this.env === 'production';
    const isStaging = this.env === 'staging';
    const isTest = this.env === 'test';

    const mongoUri = process.env.MONGO_URI || '';

    // Safety Rule 1: Test and development builds must not use production databases
    if (!isProduction && mongoUri.toLowerCase().includes('prod') && !mongoUri.toLowerCase().includes('test')) {
      throw new Error(
        `ENVIRONMENT_SAFETY_VIOLATION: Non-production environment (${this.env}) attempted to connect to a production-named database cluster.`
      );
    }

    // Safety Rule 2: Production must have real non-default secrets
    if (isProduction) {
      const jwtSecret = process.env.JWT_SECRET || '';
      if (jwtSecret.length < 32 || jwtSecret === 'secret' || jwtSecret === 'default_secret') {
        throw new Error('PRODUCTION_SECURITY_ERROR: JWT_SECRET must be at least 32 characters in production.');
      }
    }

    return {
      environment: this.env,
      isProduction,
      isStaging,
      isTest,
      workerNamespace: `${this.env}:rubaru-paid-billing`,
      status: 'GUARD_VERIFIED',
    };
  }

  /**
   * Get namespaced lease owner identifier
   */
  getWorkerLeaseOwner(workerId) {
    return `${this.env}:${workerId}`;
  }
}

const environmentGuard = new EnvironmentGuard();

module.exports = environmentGuard;
