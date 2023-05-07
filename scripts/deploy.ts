import { Collection } from '../wrappers/Collection';
import { compile, NetworkProvider } from '@ton-community/blueprint';
import { buildOnChainMetadata, data } from '../helpers/metadata';
import { Item } from '../wrappers/Item';
import { Authority } from '../wrappers/Authority';
import { toNano } from 'ton-core';

export async function run(provider: NetworkProvider) {
  const authorityCode = await compile('Authority');
  const collectionCode = await compile('Collection');
  const itemCode = await compile('Item');

  const authority = provider.open(Authority.createFromConfig({
    ownerAddress: provider.sender().address!,
    itemPrice: toNano('1.1'),
    collectionCode,
    itemCode,
  }, authorityCode));

  // await authority.sendDeploy(provider.sender());
  // await provider.waitForDeploy(authority.address, 30);

  const map = 'assets/map.svg';
  const metadata = buildOnChainMetadata(data);
  await authority.sendDeployVersion(provider.sender(), metadata, map);
  const collection = provider.open(Collection.createFromConfig({
    authorityAddress: authority.address,
    collectionData: metadata,
    map,
    itemCode,
  }, collectionCode));
  await provider.waitForDeploy(collection.address, 30);

  // const content = {
  //   colorSchema: {
  //     backgroundColor: { r: 0, g: 0, b: 0, a: 100 },
  //     bordersColor: { r: 0, g: 255, b: 0, a: 100 },
  //     visitedColor: { r: 0, g: 0, b: 255, a: 100 },
  //     unvisitedColor: { r: 0, g: 0, b: 0, a: 100 },
  //   },
  //   flags: Array(220).fill(true).map(() => Math.random() < 0.5),
  // };
  // await authority.sendDeployItem(provider.sender(), provider.sender().address!, content);
  // const itemAddress = await authority.getItemAddressByOwnerAddress(provider.sender().address!);
  // const item = Item.createFromAddress(itemAddress);
  // await provider.waitForDeploy(item.address, 30);
}
