module.exports = {
	apps: [
		{
			name: "server",
			script: "bun run start",
		},
		{
			name: "services",
			script: "bun run start:services",
		},
		{
			name: "miner1",
			script: "bun run start:miner1",
		},
		{
			name: "miner2",
			script: "bun run start:miner2",
		},
		{
			name: "miner3",
			script: "bun run start:miner3",
		},
	],

	// Deployment Configuration
	deploy: {
		production: {
			user: "root",
			host: ["128.140.57.252"],
			ref: "origin/main",
			repo: "git@github.com:youcefs21/IGDatabase.git",
			path: "/root/IGDatabase",
			// "pre-deploy-local":
			// 	"scp .env.production root@128.140.57.252:/root/IGDatabase/source/.env",
			"post-deploy":
				// kill all current process for good
				"ls -la && " +
				"export BUN_INSTALL=/root/.bun && " +
				"export PATH=/root/.bun/bin:$PATH && " +
				"docker compose up -d --remove-orphans && " +
				"bun install && bun run build && " +
				// "bun run db:migrate && " +
				"pm2 reload server",
		},
		restart_production: {
			user: "root",
			host: ["128.140.57.252"],
			ref: "origin/main",
			repo: "git@github.com:youcefs21/IGDatabase.git",
			path: "/root/IGDatabase",
			// "pre-deploy-local":
			// 	"scp .env.production root@128.140.57.252:/root/IGDatabase/source/.env",
			"post-deploy":
				// kill all current process for good
				"ls -la && " +
				"export BUN_INSTALL=/root/.bun && " +
				"export PATH=/root/.bun/bin:$PATH && " +
				"docker compose up -d --remove-orphans && " +
				"bun install && bun run build && " +
				// "bun run db:migrate && " +
				"pm2 reload ecosystem.config.cjs --env restart_production",
		},
	},
};
