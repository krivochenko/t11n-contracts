import { Blockchain, SandboxContract, TreasuryContract } from '@ton-community/sandbox';
import { Cell, Dictionary, toNano } from 'ton-core';
import { Collection, generateItemContent } from '../wrappers/Collection';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';
import { Item } from '../wrappers/Item';
import { Authority } from '../wrappers/Authority';
import { buildOnChainMetadata, data, parseMetadata } from '../helpers/metadata';
import { readFileSync } from 'fs';
import { mapToCell } from '../helpers/map';

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
    const { all, batches, countriesCount } = mapToCell('tests/files/maps/test-1.svg', 2);
    await authority.sendDeployVersion(deployer.getSender(), collectionData, all.hash(), countriesCount);

    const authorityAddress = authority.address;
    const collectionConfig = { authorityAddress, ownerAddress: deployer.address, collectionData, mapHash: all.hash(), itemCode };
    const collection = blockchain.openContract(Collection.createFromConfig(collectionConfig, collectionCode));

    for (const batch of batches) {
      await collection.sendFillVersion(deployer.getSender(), batch);
    }
    const map = await collection.getMap();
    expect(map).toEqualCell(all);

    await collection.sendReleaseVersion(deployer.getSender());

    const latestVersion = await authority.getLatestVersion();
    expect(latestVersion).not.toBeNull();
    expect(latestVersion!.address).toEqualAddress(collection.address)
    expect(latestVersion!.countriesCount).toBe(5);
  });

  it('should deploy item and return correct data', async () => {
    const { all, batches, countriesCount } = mapToCell('tests/files/maps/test-1.svg', 2);
    await authority.sendDeployVersion(deployer.getSender(), collectionData, all.hash(), countriesCount);

    const authorityAddress = authority.address;
    const collectionConfig = { authorityAddress, ownerAddress: deployer.address, collectionData, mapHash: all.hash(), itemCode };
    const collection = blockchain.openContract(Collection.createFromConfig(collectionConfig, collectionCode));

    for (const batch of batches) {
      await collection.sendFillVersion(deployer.getSender(), batch);
    }
    await collection.sendReleaseVersion(deployer.getSender());

    const itemContent = {
      colorSchema: {
        backgroundColor: { r: 0, g: 0, b: 0, a: 100 },
        bordersColor: { r: 255, g: 255, b: 255, a: 100 },
        visitedColor: { r: 255, g: 0, b: 0, a: 100 },
        unvisitedColor: { r: 0, g: 255, b: 0, a: 100 },
      },
      flags: [true, false, false, true, true],
    };
    await authority.sendDeployItem(deployer.getSender(), deployer.address, itemContent);

    const [nextItemIndex, collectionContent, collectionOwnerAddress] = await collection.getCollectionData();

    expect(nextItemIndex).toBe(0n);
    expect(collectionContent).toEqualCell(buildOnChainMetadata(data));
    expect(collectionOwnerAddress).toEqualAddress(authority.address);

    const itemAddress = await authority.getItemAddressByOwnerAddress(deployer.address);
    const item = blockchain.openContract(Item.createFromAddress(itemAddress));
    const [init, index, collectionAddress, itemOwnerAddress, content] = await item.getNftData();

    expect(init).toBe(true);
    expect(collectionAddress).toEqualAddress(collection.address);
    expect(itemOwnerAddress).toEqualAddress(deployer.address);
    expect(content).toEqualCell(generateItemContent(itemContent));

    const nftContent = await collection.getNftContent(index, content);
    const metadataDict = nftContent.beginParse().skip(8).loadDict(Dictionary.Keys.Buffer(32), Dictionary.Values.Cell());
    const parsedMetadata = parseMetadata(metadataDict, ['name', 'description', 'image_data']);
    expect(parsedMetadata).toEqual({
      name: '3 countries visited',
      description: 'For mint or update your map, please open @t11n_bot Telegram bot',
      image_data: readFileSync('tests/files/results/result-1.svg').toString('utf-8'),
    });
  });

  it('should edit item', async () => {
    const { all, batches, countriesCount } = mapToCell('tests/files/maps/test-1.svg', 2);
    await authority.sendDeployVersion(deployer.getSender(), collectionData, all.hash(), countriesCount);

    const authorityAddress = authority.address;
    const collectionConfig = { authorityAddress, ownerAddress: deployer.address, collectionData, mapHash: all.hash(), itemCode };
    const collection = blockchain.openContract(Collection.createFromConfig(collectionConfig, collectionCode));

    for (const batch of batches) {
      await collection.sendFillVersion(deployer.getSender(), batch);
    }
    await collection.sendReleaseVersion(deployer.getSender());

    const itemContent = {
      colorSchema: {
        backgroundColor: { r: 0, g: 0, b: 0, a: 100 },
        bordersColor: { r: 255, g: 255, b: 255, a: 100 },
        visitedColor: { r: 255, g: 0, b: 0, a: 100 },
        unvisitedColor: { r: 0, g: 255, b: 0, a: 100 },
      },
      flags: [true, false, false, true, true],
    };
    await authority.sendDeployItem(deployer.getSender(), deployer.address, itemContent);

    const itemAddress = await authority.getItemAddressByOwnerAddress(deployer.address);
    const item = blockchain.openContract(Item.createFromAddress(itemAddress));

    const newItemContent = {
      colorSchema: {
        backgroundColor: { r: 0, g: 0, b: 0, a: 100 },
        bordersColor: { r: 255, g: 255, b: 255, a: 100 },
        visitedColor: { r: 255, g: 0, b: 0, a: 100 },
        unvisitedColor: { r: 0, g: 255, b: 0, a: 100 },
      },
      flags: [true, true, true, true, true],
    };
    await item.sendEditContent(deployer.getSender(), newItemContent);
    const [, index, , , newContent] = await item.getNftData();

    expect(newContent).toEqualCell(generateItemContent(newItemContent));
    const newNftContent = await collection.getNftContent(index, newContent);
    const newMetadataDict = newNftContent.beginParse().skip(8).loadDict(Dictionary.Keys.Buffer(32), Dictionary.Values.Cell());
    const newParsedMetadata = parseMetadata(newMetadataDict, ['name', 'description', 'image_data']);
    expect(newParsedMetadata).toEqual({
      name: '5 countries visited',
      description: 'For mint or update your map, please open @t11n_bot Telegram bot',
      image_data: readFileSync('tests/files/results/result-2.svg').toString('utf-8'),
    });
  });

  it('should upgrade item', async () => {
    const { all: v1All, batches: v1Batches, countriesCount: v1CountriesCount } = mapToCell('tests/files/maps/test-1.svg', 2);
    await authority.sendDeployVersion(deployer.getSender(), collectionData, v1All.hash(), v1CountriesCount);

    const authorityAddress = authority.address;
    const v1Config = { authorityAddress, ownerAddress: deployer.address, collectionData, mapHash: v1All.hash(), itemCode };
    const v1 = blockchain.openContract(Collection.createFromConfig(v1Config, collectionCode));

    for (const batch of v1Batches) {
      await v1.sendFillVersion(deployer.getSender(), batch);
    }
    await v1.sendReleaseVersion(deployer.getSender());

    const itemContent = {
      colorSchema: {
        backgroundColor: { r: 0, g: 0, b: 0, a: 100 },
        bordersColor: { r: 255, g: 255, b: 255, a: 100 },
        visitedColor: { r: 255, g: 0, b: 0, a: 100 },
        unvisitedColor: { r: 0, g: 255, b: 0, a: 100 },
      },
      flags: [true, false, false, true, true],
    };
    await authority.sendDeployItem(deployer.getSender(), deployer.address, itemContent);

    const itemAddress = await authority.getItemAddressByOwnerAddress(deployer.address);
    const item = blockchain.openContract(Item.createFromAddress(itemAddress));

    const { all: v2All, batches: v2Batches, countriesCount: v2CountriesCount } = mapToCell('tests/files/maps/test-2.svg', 2);
    const v2Config = { authorityAddress, ownerAddress: deployer.address, collectionData, mapHash: v2All.hash(), itemCode };
    const v2 = blockchain.openContract(Collection.createFromConfig(v2Config, collectionCode));

    await authority.sendDeployVersion(deployer.getSender(), collectionData, v2All.hash(), v2CountriesCount);
    for (const batch of v2Batches) {
      await v2.sendFillVersion(deployer.getSender(), batch);
    }
    await v2.sendReleaseVersion(deployer.getSender());

    const latestVersion = await authority.getLatestVersion();
    expect(latestVersion!.address).toEqualAddress(v2.address);

    await authority.sendUpgradeItem(deployer.getSender(), itemContent);
    const [, index, collectionAddress, , content] = await item.getNftData();
    expect(collectionAddress).toEqualAddress(latestVersion!.address);
    expect(content).toEqualCell(generateItemContent(itemContent));

    const nftContentAfterUpgrade = await v2.getNftContent(index, content);
    const metadataDictAfterUpgrade = nftContentAfterUpgrade.beginParse().skip(8).loadDict(Dictionary.Keys.Buffer(32), Dictionary.Values.Cell());
    const parsedMetadataAfterUpgrade = parseMetadata(metadataDictAfterUpgrade, ['name', 'description', 'image_data']);
    expect(parsedMetadataAfterUpgrade).toEqual({
      name: '3 countries visited',
      description: 'For mint or update your map, please open @t11n_bot Telegram bot',
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
