import { Blockchain, SandboxContract, TreasuryContract } from '@ton-community/sandbox';
import { Cell, Dictionary, toNano } from 'ton-core';
import { Collection, generateItemContent } from '../wrappers/Collection';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';
import { Item } from '../wrappers/Item';
import { Authority } from '../wrappers/Authority';
import { buildOnChainMetadata, data, parseMetadata } from '../helpers/metadata';
import { readFileSync } from 'fs';

describe('Authority', () => {
  const collectionData = buildOnChainMetadata(data);

  let authorityCode: Cell;
  let collectionCode: Cell;
  let itemCode: Cell;
  let deployer: SandboxContract<TreasuryContract>;

  beforeAll(async () => {
    authorityCode = await compile('Authority');
    collectionCode = await compile('Collection');
    itemCode = await compile('Item');
  });

  let blockchain: Blockchain;
  let authority: SandboxContract<Authority>;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    deployer = await blockchain.treasury('deployer');

    authority = blockchain.openContract(Authority.createFromConfig({
      ownerAddress: deployer.address,
      itemPrice: toNano('1.1'),
      collectionCode,
      itemCode,
    }, authorityCode));

    const deployResult = await authority.sendDeploy(deployer.getSender());

    expect(deployResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: authority.address,
      deploy: true,
      success: true,
    });
  });

  it('should return null latest version', async () => {
    const latestVersion = await authority.getLatestVersion();
    expect(latestVersion).toBeNull();
  });

  it('should deploy version and return correct data about it', async () => {
    await authority.sendDeployVersion(deployer.getSender(), collectionData, 'tests/files/maps/test-1.svg');
    const authorityAddress = authority.address;
    const collection = blockchain.openContract(Collection.createFromConfig({ authorityAddress, collectionData, map: 'tests/files/maps/test-1.svg', itemCode }, collectionCode));

    const latestCollection = await authority.getLatestVersion();
    expect(latestCollection).not.toBeNull();
    expect(latestCollection!.address).toEqualAddress(collection.address)
    expect(latestCollection!.countriesCount).toBe(5);
  });

  it('should deploy item and return correct data', async () => {
    await authority.sendDeployVersion(deployer.getSender(), collectionData, 'tests/files/maps/test-1.svg');
    const authorityAddress = authority.address;
    const collection = blockchain.openContract(Collection.createFromConfig({ authorityAddress, collectionData, map: 'tests/files/maps/test-1.svg', itemCode }, collectionCode));

    const itemContent = [true, false, false, true, true];
    await authority.sendDeployItem(deployer.getSender(), deployer.address, itemContent);

    const [nextItemIndex, collectionContent, collectionOwnerAddress] = await collection.getCollectionData();

    expect(nextItemIndex).toBe(0n);
    expect(collectionContent).toEqualCell(buildOnChainMetadata(data));
    expect(collectionOwnerAddress).toEqualAddress(authority.address);

    const itemIndex = await authority.getNftIndexByOwnerAddress(deployer.address);
    const item = blockchain.openContract(Item.createFromConfig({ authorityAddress, index: itemIndex }, itemCode));
    const [init, index, collectionAddress, itemOwnerAddress, content] = await item.getNftData();

    expect(init).toBe(true);
    expect(index).toBe(itemIndex);
    expect(collectionAddress).toEqualAddress(collection.address);
    expect(itemOwnerAddress).toEqualAddress(deployer.address);
    expect(content).toEqualCell(generateItemContent(itemContent));

    const nftContent = await collection.getNftContent(index, content);
    const metadataDict = nftContent.beginParse().skip(8).loadDict(Dictionary.Keys.Buffer(32), Dictionary.Values.Cell());
    const parsedMetadata = parseMetadata(metadataDict, ['name', 'description', 'image_data']);
    expect(parsedMetadata).toEqual({
      name: 'Name',
      description: 'Description',
      image_data: readFileSync('tests/files/results/result-1.svg').toString('utf-8'),
    });
  });

  it('should edit item', async () => {
    await authority.sendDeployVersion(deployer.getSender(), collectionData, 'tests/files/maps/test-1.svg');
    const authorityAddress = authority.address;
    const collection = blockchain.openContract(Collection.createFromConfig({ authorityAddress, collectionData, map: 'tests/files/maps/test-1.svg', itemCode }, collectionCode));

    const itemContent = [true, false, false, true, true];
    await authority.sendDeployItem(deployer.getSender(), deployer.address, itemContent);

    const itemIndex = await authority.getNftIndexByOwnerAddress(deployer.address);
    const item = blockchain.openContract(Item.createFromConfig({ authorityAddress, index: itemIndex }, itemCode));

    const newItemContent = [true, true, true, true, true];
    await item.sendEditContent(deployer.getSender(), newItemContent);
    const [, , , , newContent] = await item.getNftData();

    expect(newContent).toEqualCell(generateItemContent(newItemContent));
    const newNftContent = await collection.getNftContent(itemIndex, newContent);
    const newMetadataDict = newNftContent.beginParse().skip(8).loadDict(Dictionary.Keys.Buffer(32), Dictionary.Values.Cell());
    const newParsedMetadata = parseMetadata(newMetadataDict, ['name', 'description', 'image_data']);
    expect(newParsedMetadata).toEqual({
      name: 'Name',
      description: 'Description',
      image_data: readFileSync('tests/files/results/result-2.svg').toString('utf-8'),
    });
  });

  it('should upgrade item', async () => {
    await authority.sendDeployVersion(deployer.getSender(), collectionData, 'tests/files/maps/test-1.svg');
    const authorityAddress = authority.address;
    const v1 = blockchain.openContract(Collection.createFromConfig({ authorityAddress, collectionData, map: 'tests/files/maps/test-1.svg', itemCode }, collectionCode));

    await authority.sendDeployItem(deployer.getSender(), deployer.address, [true, false, false, true, true]);
    const itemIndex = await authority.getNftIndexByOwnerAddress(deployer.address);
    const item = blockchain.openContract(Item.createFromConfig({ authorityAddress, index: itemIndex }, itemCode));

    await authority.sendDeployVersion(deployer.getSender(), collectionData, 'tests/files/maps/test-2.svg');
    const latestVersion = await authority.getLatestVersion();
    expect(latestVersion!.address).not.toEqualAddress(v1!.address);

    await authority.sendUpgradeItem(deployer.getSender(), [true, true, true, true]);
    const [, , collectionAddress, , itemContent] = await item.getNftData();
    expect(collectionAddress).toEqualAddress(latestVersion!.address);
    expect(itemContent).toEqualCell(generateItemContent([true, true, true, true]));

    const v2 = blockchain.openContract(Collection.createFromAddress(latestVersion!.address))
    const nftContentAfterUpgrade = await v2.getNftContent(itemIndex, itemContent);
    const metadataDictAfterUpgrade = nftContentAfterUpgrade.beginParse().skip(8).loadDict(Dictionary.Keys.Buffer(32), Dictionary.Values.Cell());
    const parsedMetadataAfterUpgrade = parseMetadata(metadataDictAfterUpgrade, ['name', 'description', 'image_data']);
    expect(parsedMetadataAfterUpgrade).toEqual({
      name: 'Name',
      description: 'Description',
      image_data: readFileSync('tests/files/results/result-3.svg').toString('utf-8'),
    });
  });

  it('should set item price', async () => {
    const initialPrice = await authority.getItemPrice();
    expect(initialPrice).toBe(toNano('1.1'));

    await authority.sendSetItemPrice(deployer.getSender(), toNano('2'));

    const updatedPrice = await authority.getItemPrice();
    expect(updatedPrice).toBe(toNano('2'));
  });

  it('should withdraw', async () => {
    const ownerInitialBalance = await deployer.getBalance();

    await authority.sendWithdraw(deployer.getSender());

    const ownerUpdatedBalance = await deployer.getBalance();

    expect(ownerUpdatedBalance).toBeGreaterThan(ownerInitialBalance);
  });
});
