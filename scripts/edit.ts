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

  const itemIndex = await collection.getNftIndexByOwnerAddress(provider.sender().address!);
  const item = provider.open(Item.createFromConfig({ index: itemIndex, collectionAddress: collection.address }, itemCode));
  await item.sendEditContent(provider.sender(), ['ff0000', '00ff00']);
}
