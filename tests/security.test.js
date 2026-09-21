import test from "node:test";
import assert from "node:assert";
import { installDependencies } from "../utils/installer.js";
import path from "path";

test("installDependencies should reject shell metacharacters in dependencies", async () => {
  const projectPath = path.join(process.cwd(), "dummy_project");

  const maliciousDependencies = ["express", "&&", "rm", "-rf", "/"];

  await assert.rejects(
    async () => {
      await installDependencies(projectPath, {}, "dummy", true, maliciousDependencies);
    },
    {
      name: "Error",
      message: /Invalid package name rejected: &&/,
    },
    "Should throw error for malicious package argument '&&'"
  );

  const maliciousDependencies2 = ["express;echo", "vuln"];
  await assert.rejects(
    async () => {
      await installDependencies(projectPath, {}, "dummy", true, maliciousDependencies2);
    },
    {
      name: "Error",
      message: /Invalid package name rejected: express;echo/,
    },
    "Should throw error for malicious package argument 'express;echo'"
  );
});
