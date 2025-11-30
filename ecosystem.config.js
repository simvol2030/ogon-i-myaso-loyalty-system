module.exports = {
  apps: [
    {
      name: 'murzicoin-frontend',
      cwd: '/opt/websites/murzicoin.murzico.ru/frontend-sveltekit',
      script: 'build/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: '3009',
        ORIGIN: 'https://murzicoin.murzico.ru',
        SESSION_SECRET: '/h3mrzqmVEweenR+NiQV5CUWkhAcpEccOw+jorAhPgA=',
        PUBLIC_BACKEND_URL: 'http://localhost:3015'
      },
      error_file: '/opt/websites/murzicoin.murzico.ru/logs/frontend-error.log',
      out_file: '/opt/websites/murzicoin.murzico.ru/logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'murzicoin-backend',
      cwd: '/opt/websites/murzicoin.murzico.ru/backend-expressjs',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: '3015',
        SESSION_SECRET: '/h3mrzqmVEweenR+NiQV5CUWkhAcpEccOw+jorAhPgA='
      },
      error_file: '/opt/websites/murzicoin.murzico.ru/logs/backend-error.log',
      out_file: '/opt/websites/murzicoin.murzico.ru/logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'murzicoin-bot',
      cwd: '/opt/websites/murzicoin.murzico.ru/telegram-bot',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: '2017'
      },
      error_file: '/opt/websites/murzicoin.murzico.ru/logs/bot-error.log',
      out_file: '/opt/websites/murzicoin.murzico.ru/logs/bot-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
