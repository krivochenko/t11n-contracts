import { compile, NetworkProvider } from '@ton-community/blueprint';
import { Mapmaker } from '../wrappers/Mapmaker';
import { mapToCell } from '../helpers/map';

const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

export async function run(provider: NetworkProvider) {
  const mapmakerCode = await compile('Mapmaker');

  const mapmaker = provider.open(Mapmaker.createFromConfig({ ownerAddress: provider.sender().address! }, mapmakerCode));

  const batchSize = 30;
  const skip = 0;
  const { batches } = mapToCell('assets/map.svg', batchSize, skip);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    await mapmaker.sendFillMap(provider.sender(), batch);
    provider.ui().write(`${skip + (i + 1) * batchSize} countries loaded`);
    await delay(20 * 1000);
  }
}
