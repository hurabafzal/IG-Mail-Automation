import { app } from "./api/app";

app.listen({ port: 3000, idleTimeout: 60 });

console.log("Server started on http://localhost:3000. Backend only");
