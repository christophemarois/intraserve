const path = require('path')

console.log(`\x1b[36m
============================
Welcome to intraserve's demo!
Available at: http://localtest.me

This demo uses https://readme.localtest.me/ to demonstrate the vhost behavior.
All this does is redirect all requests to 127.0.0.1:80

Two demo "apps" are available, one static and one proxied.
Two users are available:

1. user/demo - has access to the static app only
2. admin/demo - has access to every app

Inspect this configuration file if you want:
${path.resolve(__dirname, __filename)}

Have fun!
============================
\x1b[0m`)

module.exports = {
  domain: 'localtest.me',
  usersFilepath: path.resolve(__dirname, 'users.json'),
  apps: [
    {
      id: 'static',
      name: 'Static Example',
      description: 'Serve static intraserve example folder',
      host: 'static.localtest.me',
      getMiddleware ({ static, proxy }) {
        return (req, res) => static(req, res, {
          public: path.resolve(__dirname, 'static')
        })
      }
    },
    {
      id: 'gist-proxy',
      name: 'Gist proxy',
      description: 'Serve gist.github.com with mobile User-Agent',
      host: 'gist.localtest.me',
      path: '/christophemarois',
      public: [
        '/christophemarois'
      ],
      getMiddleware ({ static, proxy }) {
        return proxy({
          target: 'https://gist.github.com',
          changeOrigin: true,
          ws: true,
          onProxyReq (proxyReq, req, res) {
            // Inject a special header to notify the target that we are authenticated
            if (req.session && req.session.username) {
              // Please use jsonwebtokens though lol
              proxyReq.setHeader('X-Intraserve-Token', req.session.user)
            }
            
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_3_1 like Mac OS X) AppleWebKit/603.1.30 (KHTML, like Gecko) Version/10.0 Mobile/14E304 Safari/602.1')
          }
        })
      }
    },
  ]
}