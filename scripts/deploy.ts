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
        nextItemIndex: 0,
        content: buildOnChainMetadata(data),
        nftItemCode: itemCode,
    }, collectionCode));

    await collection.sendDeploy(provider.sender(), toNano('0.1'));
    await provider.waitForDeploy(collection.address);

    await collection.sendDeployNftItem(provider.sender(), provider.sender().address!);

    const item = Item.createFromConfig({ index: 0, collectionAddress: collection.address }, itemCode);
    await provider.waitForDeploy(item.address);
}