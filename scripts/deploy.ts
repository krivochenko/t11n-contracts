import { toNano } from 'ton-core';
import { Collection } from '../wrappers/Collection';
import { compile, NetworkProvider } from '@ton-community/blueprint';
import { buildOnChainMetadata, data } from '../helpers/metadata';
import { Item } from '../wrappers/Item';

export async function run(provider: NetworkProvider) {
  const collectionCode = await compile('Collection');
  const itemCode = await compile('Item');

  const collection = provider.open(Collection.createFromConfig({
    ownerAddress: provider.sender().address!,
    content: buildOnChainMetadata(data),
    circles: [
      { x: 60, y: 50, radius: 20 },
      { x: 40, y: 50, radius: 20 },
    ],
    nftItemCode: itemCode,
  }, collectionCode));

  await collection.sendDeploy(provider.sender(), toNano('0.1'));
  await provider.waitForDeploy(collection.address);

  await collection.sendDeployNftItem(provider.sender(), provider.sender().address!, ['000000', 'ffffff']);

  const itemIndex = await collection.getNftIndexByOwnerAddress(provider.sender().address!);

  const item = Item.createFromConfig({ index: itemIndex, collectionAddress: collection.address }, itemCode);
  await provider.waitForDeploy(item.address);
}
