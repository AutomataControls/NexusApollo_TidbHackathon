module.exports = {
  "apps": [
    {
      "name": "apollo-nexus",
      "script": "./portal/server.js",
      "cwd": "/home/Automata/mydata/apollo-nexus",
      "instances": 1,
      "exec_mode": "cluster",
      "watch": false,
      "env": {
        "NODE_ENV": "production",
        "PORT": "8001"
      },
      "error_file": "./logs/pm2-error.log",
      "out_file": "./logs/pm2-out.log",
      "merge_logs": true,
      "time": true,
      "node_args": "--max-old-space-size=2048"
    }
  ]
}