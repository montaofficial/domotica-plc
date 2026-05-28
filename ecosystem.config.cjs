// PM2 process manager config.
// Usage:
//   pm2 start ecosystem.config.cjs
//   pm2 save
//   pm2 startup        # follow the printed instructions once, to enable boot
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
      // Stop trying after 10 quick failures to avoid restart loops.
      max_restarts: 10
    }
  ]
};
