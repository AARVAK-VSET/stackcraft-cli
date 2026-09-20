import { setupProject } from "../utils/project.js";

export async function createProject(projectName, config, options = {}) {
  return await setupProject(projectName, config, options);
}
