import { Collection } from '../wrappers/Collection';
import { compile, NetworkProvider } from '@ton-community/blueprint';
import { Item } from '../wrappers/Item';
import { Authority } from '../wrappers/Authority';

export async function run(provider: NetworkProvider) {
  const authorityCode = await compile('Authority');
  const collectionCode = await compile('Collection');
  const itemCode = await compile('Item');

  const authority = provider.open(Authority.createFromConfig({
    ownerAddress: provider.sender().address!,
    collectionCode,
    itemCode,
  }, authorityCode));

  console.log(authority.address);
  console.log(await authority.getLatestVersion());
}