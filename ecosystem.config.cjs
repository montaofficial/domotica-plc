// PM2 process manager config.
// Usage:
//   pm2 start ecosystem.config.cjs
//   pm2 save
//   pm2 startup        # follow the printed instructions once, to enable boot
//
// Log rotation (run ONCE per machine, otherwise logs grow until the disk fills
// and SQLite writes start failing):
//   pm2 install pm2-logrotate
//   pm2 set pm2-logrotate:max_size 20M
//   pm2 set pm2-logrotate:retain 14
//   pm2 set pm2-logrotate:compress true
module.exports = {
  apps: [
    {
      name: 'domotica-plc',
      script: './server/index.js',
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production'
      },
      // .env is loaded by the app itself via dotenv, so no need to duplicate
      // secrets here. Keep this file safe to commit.
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      // Wait 4s before considering a fresh boot stable.
      min_uptime: 4000,
      // Cap rapid crash loops, but back off exponentially between restarts and
      // allow far more attempts before giving up: a transient cause (disk full,
      // gateway missing at boot) shouldn't leave the building with no controller.
      max_restarts: 50,
      restart_delay: 2000,
      exp_backoff_restart_delay: 200,
      // Give the process time to close the DB/WS cleanly on stop before SIGKILL
      // (matches the 10s forced-exit guard in server/index.js).
      kill_timeout: 11000
    }
  ]
};
