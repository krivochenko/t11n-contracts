import { Collection } from '../wrappers/Collection';
import { compile, NetworkProvider } from '@ton-community/blueprint';
import { buildOnChainMetadata, data } from '../helpers/metadata';
import { Item } from '../wrappers/Item';
import { toNano } from 'ton-core';

export async function run(provider: NetworkProvider) {
    const collectionCode = await compile('Collection');
    const itemCode = await compile('Item');

    const collection = provider.open(Collection.createFromConfig({
        ownerAddress: provider.sender().address!,
        nextItemIndex: 0,
        content: buildOnChainMetadata(data),
        nftItemCode: itemCode,
    }, collectionCode));
    const item = provider.open(Item.createFromConfig({ index: 0, collectionAddress: collection.address }, itemCode));

    await item.sendTransfer(provider.sender(), toNano('0.05'));
}
