module.exports = {
  apps: [{
    name: 'apollo-nexus',
    script: 'server.js',
    cwd: '/home/Automata/mydata/apollo-nexus/portal',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 8001,
      POSTGRES_HOST: 'localhost',
      POSTGRES_PORT: 5432,
      POSTGRES_DB: 'apollo_nexus',
      POSTGRES_USER: 'DevOps',
      POSTGRES_PASS: 'Invertedskynet2$',
      SQLITE_DB_PATH: './data/sensor_data.db',
      JWT_SECRET: 'apollo-nexus-secret-key-change-in-production',
      SENSOR_POLL_INTERVAL: 1000,
      MAX_UPLOAD_SIZE: '100mb',
      LOG_LEVEL: 'info'
    },
    error_file: '/home/Automata/mydata/apollo-nexus/logs/pm2-error.log',
    out_file: '/home/Automata/mydata/apollo-nexus/logs/pm2-out.log',
    log_file: '/home/Automata/mydata/apollo-nexus/logs/pm2-combined.log',
    time: true,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }, {
    name: 'cloudflared',
    script: '/usr/local/bin/cloudflared',
    args: '--config /home/Automata/.cloudflared/config.yml tunnel run',
    cwd: '/home/Automata',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    error_file: '/home/Automata/mydata/apollo-nexus/logs/cloudflared-error.log',
    out_file: '/home/Automata/mydata/apollo-nexus/logs/cloudflared-out.log',
    time: true,
    max_restarts: 10,
    min_uptime: 10000
  }]
};