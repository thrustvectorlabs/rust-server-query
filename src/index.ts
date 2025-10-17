import { GameDig } from 'gamedig';
import { config } from '../config.js';

async function queryServer() {
  try {
    const result = await GameDig.query({
      type: config.SERVER_TYPE,
      host: config.SERVER_HOST,
      port: config.SERVER_PORT,
    });

    // Match: jq ".name, .players"
    console.log(JSON.stringify(result.name));
    console.log(JSON.stringify(result.players, null, 2));
  } catch (err) {
    // Match CLI behavior by printing an error and exiting nonzero for single run
    const errorMessage = typeof err === 'object' && err !== null && 'message' in err
      ? (err as { message: string }).message
      : String(err);
    console.error(JSON.stringify({ error: errorMessage }));
    if (config.INTERVAL === 0) process.exit(2);
  }
}

// Basic bootstrap using tsx + ESM + Node 24
const main = async () => {
  const nodeVersion = process.versions.node;
  const typescriptVersion = (await import('typescript')).version;

  console.log('🚀 App started with tsx');
  console.log(`Node: ${nodeVersion}`);
  console.log(`TypeScript: ${typescriptVersion}`);

  // Example top-level await-friendly async work:
  await new Promise((resolve) => setTimeout(resolve, 250));
  console.log('All set. Your tsx runtime is working!');

  if (config.INTERVAL > 0) {
    // Loop with clear and sleep
    // First immediate run
    // Then setInterval
    await (async () => {
      console.clear();
      await queryServer();
    })();

    setInterval(async () => {
      console.clear();
      await queryServer();
    }, config.INTERVAL * 1000);
  } else {
    await queryServer();
  }
};

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});