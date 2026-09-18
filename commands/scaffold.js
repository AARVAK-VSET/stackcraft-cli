import { setupProject } from "../utils/project.js";

export async function createProject(projectName, config) {
  return await setupProject(projectName, config);
}
