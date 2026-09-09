import "dotenv/config";

import {
  disconnectDemoFixtureClient,
  resetDemoFixtures,
} from "../lib/demo/fixtures";

async function main() {
  const result = await resetDemoFixtures();
  console.log("Demo fixture reset complete.", result);
  console.log(
    "Demo accounts: admin@worklens.demo, manager@worklens.demo, employee@worklens.demo",
  );
}

void main()
  .catch(() => {
    console.error(
      "Demo fixture reset failed. Confirm DATABASE_URL targets the dedicated demo database.",
    );
    process.exitCode = 1;
  })
  .finally(disconnectDemoFixtureClient);
