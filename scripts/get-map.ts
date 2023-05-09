import { compile, NetworkProvider } from '@ton-community/blueprint';
import { Mapmaker } from '../wrappers/Mapmaker';

export async function run(provider: NetworkProvider) {
  const mapmakerCode = await compile('Mapmaker');

  const mapmaker = provider.open(Mapmaker.createFromConfig({ ownerAddress: provider.sender().address! }, mapmakerCode));

  const [map, countriesCount] = await mapmaker.getMap();

  console.log(map, countriesCount);
}
