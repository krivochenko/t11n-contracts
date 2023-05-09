import { compile, NetworkProvider } from '@ton-community/blueprint';
import { Mapmaker } from '../wrappers/Mapmaker';
import { Authority } from '../wrappers/Authority';
import { toNano } from 'ton-core';
import { buildOnChainMetadata, data } from '../helpers/metadata';

export async function run(provider: NetworkProvider) {
  const mapmakerCode = await compile('Mapmaker');
  const authorityCode = await compile('Authority');
  const collectionCode = await compile('Collection');
  const itemCode = await compile('Item');

  const mapmaker = provider.open(Mapmaker.createFromConfig({ ownerAddress: provider.sender().address! }, mapmakerCode));

  const authority = provider.open(Authority.createFromConfig({
    mapmakerAddress: mapmaker.address,
    ownerAddress: provider.sender().address!,
    itemPrice: toNano('1.1'),
    collectionCode,
    itemCode,
  }, authorityCode));

  const collectionContent = buildOnChainMetadata(data);
  await mapmaker.sendDeployVersion(provider.sender(), authority.address, collectionContent);
}
