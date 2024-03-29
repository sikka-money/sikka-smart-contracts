const { ethers, network } = require('hardhat');
const { expect } = require("chai");

describe('===Vow===', function () {
    let deployer, signer1, signer2;

    let wad = "000000000000000000", // 18 Decimals
        ray = "000000000000000000000000000", // 27 Decimals
        rad = "000000000000000000000000000000000000000000000"; // 45 Decimals

    let collateral = ethers.utils.formatBytes32String("TEST");

    const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

    beforeEach(async function () {

        [deployer, signer1, signer2] = await ethers.getSigners();

        // Contract factory
        this.Vow = await ethers.getContractFactory("Vow");
        this.Vat = await ethers.getContractFactory("Vat");
        this.SikkaJoin = await ethers.getContractFactory("SikkaJoin");
        this.Sikka = await ethers.getContractFactory("Sikka");

        // Contract deployment
        vow = await this.Vow.connect(deployer).deploy();
        await vow.deployed();
        vat = await this.Vat.connect(deployer).deploy();
        await vat.deployed();
        sikkaJoin = await this.SikkaJoin.connect(deployer).deploy();
        await sikkaJoin.deployed();
        sikka = await this.Sikka.connect(deployer).deploy();
        await sikka.deployed();
    });

    describe('--- initialize()', function () {
        it('initialize', async function () {
            expect(await vow.live()).to.be.equal("0");
            await vat.initialize();
            await sikka.initialize("97", "SIKKA", "100" + wad);
            await sikkaJoin.initialize(vat.address, sikka.address);
            await vow.initialize(vat.address, sikkaJoin.address, deployer.address);
            expect(await vow.live()).to.be.equal("1");
        });
    });
    describe('--- rely()', function () {
        it('reverts: Vow/not-authorized', async function () {
            await expect(vow.rely(signer1.address)).to.be.revertedWith("Vow/not-authorized");
            expect(await vow.wards(signer1.address)).to.be.equal("0");
        });
        it('reverts: Vow/not-live', async function () {
            await vat.initialize();
            await sikka.initialize("97", "SIKKA", "100" + wad);
            await sikkaJoin.initialize(vat.address, sikka.address);
            await vow.initialize(vat.address, sikkaJoin.address, deployer.address);
            await vow.cage();
            await expect(vow.rely(signer1.address)).to.be.revertedWith("Vow/not-live");
            expect(await vow.wards(signer1.address)).to.be.equal("0");
        });
        it('relies on address', async function () {
            await vat.initialize();
            await sikka.initialize("97", "SIKKA", "100" + wad);
            await sikkaJoin.initialize(vat.address, sikka.address);
            await vow.initialize(vat.address, sikkaJoin.address, deployer.address);
            await vow.rely(signer1.address);
            expect(await vow.wards(signer1.address)).to.be.equal("1");
        });
    });
    describe('--- deny()', function () {
        it('reverts: Vow/not-authorized', async function () {
            await expect(vow.deny(signer1.address)).to.be.revertedWith("Vow/not-authorized");
        });
        it('denies an address', async function () {
            await vat.initialize();
            await sikka.initialize("97", "SIKKA", "100" + wad);
            await sikkaJoin.initialize(vat.address, sikka.address);
            await vow.initialize(vat.address, sikkaJoin.address, deployer.address);
            await vow.rely(signer1.address);
            expect(await vow.wards(signer1.address)).to.be.equal("1");
            await vow.deny(signer1.address);
            expect(await vow.wards(signer1.address)).to.be.equal("0");
        });
    });
    describe('--- file(2a)', function () {
        it('reverts: Vow/not-authorized', async function () {
            await expect(vow.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("humpy"), "100" + rad)).to.be.revertedWith("Vow/not-authorized");
        });
        it('reverts: Vow/file-unrecognized-param', async function () {
            await vat.initialize();
            await sikka.initialize("97", "SIKKA", "100" + wad);
            await sikkaJoin.initialize(vat.address, sikka.address);
            await vow.initialize(vat.address, sikkaJoin.address, deployer.address);
            await expect(vow.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("humpy"), "100" + rad)).to.be.revertedWith("Vow/file-unrecognized-param");
        });
        it('sets hump', async function () {
            await vat.initialize();
            await sikka.initialize("97", "SIKKA", "100" + wad);
            await sikkaJoin.initialize(vat.address, sikka.address);
            await vow.initialize(vat.address, sikkaJoin.address, deployer.address);
            await vow.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("hump"), "100" + rad);
            expect(await vow.hump()).to.be.equal("100" + rad);
        });
    });
    describe('--- file(2b)', function () {
        it('reverts: Vow/not-authorized', async function () {
            await expect(vow.connect(deployer)["file(bytes32,address)"](await ethers.utils.formatBytes32String("new"), deployer.address)).to.be.revertedWith("Vow/not-authorized");
        });
        it('reverts: Vow/file-unrecognized-param', async function () {
            await vat.initialize();
            await sikka.initialize("97", "SIKKA", "100" + wad);
            await sikkaJoin.initialize(vat.address, sikka.address);
            await vow.initialize(vat.address, sikkaJoin.address, deployer.address);
            await expect(vow.connect(deployer)["file(bytes32,address)"](await ethers.utils.formatBytes32String("new"), deployer.address)).to.be.revertedWith("Vow/file-unrecognized-param");
        });
        it('sets multisig', async function () {
            await vat.initialize();
            await sikka.initialize("97", "SIKKA", "100" + wad);
            await sikkaJoin.initialize(vat.address, sikka.address);
            await vow.initialize(vat.address, sikkaJoin.address, deployer.address);
            await vow.connect(deployer)["file(bytes32,address)"](await ethers.utils.formatBytes32String("multisig"), signer1.address);
            expect(await vow.multisig()).to.be.equal(signer1.address);
        });
        it('sets sikkaJoin', async function () {
            await vat.initialize();
            await sikka.initialize("97", "SIKKA", "100" + wad);
            await sikkaJoin.initialize(vat.address, sikka.address);
            await vow.initialize(vat.address, sikkaJoin.address, deployer.address);
            await vow.connect(deployer)["file(bytes32,address)"](await ethers.utils.formatBytes32String("sikkajoin"), sikkaJoin.address);
            expect(await vow.sikkaJoin()).to.be.equal(sikkaJoin.address);
        });
        it('sets sikka', async function () {
            await vat.initialize();
            await sikka.initialize("97", "SIKKA", "100" + wad);
            await sikkaJoin.initialize(vat.address, sikka.address);
            await vow.initialize(vat.address, sikkaJoin.address, deployer.address);
            await vow.connect(deployer)["file(bytes32,address)"](await ethers.utils.formatBytes32String("sikka"), sikka.address);
            expect(await vow.sikka()).to.be.equal(sikka.address);
        });
        it('sets vat', async function () {
            await vat.initialize();
            await sikka.initialize("97", "SIKKA", "100" + wad);
            await sikkaJoin.initialize(vat.address, sikka.address);
            await vow.initialize(vat.address, sikkaJoin.address, deployer.address);
            await vow.connect(deployer)["file(bytes32,address)"](await ethers.utils.formatBytes32String("vat"), vat.address);
            expect(await vow.vat()).to.be.equal(vat.address);
        });
    });
    describe('--- heal()', function () {
        it('reverts: Vow/insufficient-surplus', async function () {
            await vat.initialize();
            await sikka.initialize("97", "SIKKA", "100" + wad);
            await sikkaJoin.initialize(vat.address, sikka.address);
            await vow.initialize(vat.address, sikkaJoin.address, deployer.address);

            await expect(vow.heal("1" + rad)).to.be.revertedWith("Vow/insufficient-surplus");
        });
        it('reverts: Vow/insufficient-debt', async function () {
            await vat.initialize();
            await sikka.initialize("97", "SIKKA", "100" + wad);
            await sikkaJoin.initialize(vat.address, sikka.address);
            await vow.initialize(vat.address, sikkaJoin.address, deployer.address);

            await vat.init(collateral);
            await vat.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("Line"), "200" + rad);
            await vat.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("line"), "200" + rad);  
            await vat.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("dust"), "10" + rad);              
            await vat.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("spot"), "100" + ray);
            await vat.slip(collateral, deployer.address, "1" + wad);
            await vat.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, "1" + wad, 0);
            await vat.connect(deployer).frob(collateral, deployer.address, deployer.address, vow.address, 0, "15" + wad);

            await expect(vow.heal("1" + rad)).to.be.revertedWith("Vow/insufficient-debt");
        });
        it('reverts: Vow/not-authorized', async function () {
            await vat.initialize();
            await sikka.initialize("97", "SIKKA", "100" + wad);
            await sikkaJoin.initialize(vat.address, sikka.address);
            await vow.initialize(vat.address, sikkaJoin.address, deployer.address);

            await vat.init(collateral);
            await vat.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("Line"), "200" + rad);
            await vat.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("line"), "200" + rad);  
            await vat.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("dust"), "10" + rad);              
            await vat.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("spot"), "100" + ray);
            await vat.slip(collateral, deployer.address, "1" + wad);
            await vat.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, "1" + wad, 0);
            await vat.connect(deployer).frob(collateral, deployer.address, deployer.address, vow.address, 0, "15" + wad);
            await vat.rely(signer1.address);
            await vat.connect(signer1).grab(collateral, deployer.address, deployer.address, vow.address, "-1" + wad, "-15" + wad);
            expect(await vat.sin(vow.address)).to.be.equal("15" + rad);
            expect(await vat.sikka(vow.address)).to.be.equal("15" + rad);

            await vow.heal("10" + rad);
            expect(await vat.sin(vow.address)).to.be.equal("5" + rad);
            expect(await vat.sikka(vow.address)).to.be.equal("5" + rad);
        });
    });
    describe('--- feed()', function () {
        it('feeds surplus sikka to vow', async function () {
            await vat.initialize();
            await sikka.initialize("97", "SIKKA", "100" + wad);
            await sikkaJoin.initialize(vat.address, sikka.address);
            await vow.initialize(vat.address, sikkaJoin.address, deployer.address);

            await vat.init(collateral);
            await vat.rely(vow.address);
            await vat.rely(sikkaJoin.address);
            await vat.hope(sikkaJoin.address);
            await vat.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("Line"), "200" + rad);
            await vat.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("line"), "200" + rad);  
            await vat.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("dust"), "10" + rad);              
            await vat.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("spot"), "100" + ray);
            await vat.slip(collateral, deployer.address, "1" + wad);
            await vat.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, "1" + wad, 0);
            await vat.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, 0, "15" + wad);

            await vow.connect(deployer)["file(bytes32,address)"](await ethers.utils.formatBytes32String("sikka"), sikka.address);
            await sikka.connect(deployer).rely(sikkaJoin.address);
            await sikkaJoin.connect(deployer).rely(vow.address);
            await sikkaJoin.connect(deployer).exit(deployer.address, "10" + wad);
            expect(await sikka.balanceOf(deployer.address)).to.be.equal("10" + wad);

            await sikka.connect(deployer).approve(vow.address, "10" + wad);
            await vow.connect(deployer).feed("10" + wad);
            expect(await vat.sikka(vow.address)).to.be.equal("10" + rad);
        });
    });
    describe('--- flap()', function () {
        it('reverts: Vow/insufficient-surplus', async function () {
            await vat.initialize();
            await sikka.initialize("97", "SIKKA", "100" + wad);
            await sikkaJoin.initialize(vat.address, sikka.address);
            await vow.initialize(vat.address, sikkaJoin.address, deployer.address);

            await vat.init(collateral);
            await vat.rely(vow.address);
            await vat.rely(sikkaJoin.address);
            await vat.hope(sikkaJoin.address);
            await vat.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("Line"), "200" + rad);
            await vat.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("line"), "200" + rad);  
            await vat.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("dust"), "10" + rad);              
            await vat.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("spot"), "100" + ray);
            await vat.slip(collateral, deployer.address, "1" + wad);
            await vat.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, "1" + wad, 0);
            await vat.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, 0, "15" + wad);
            await vat.connect(deployer).move(deployer.address, vow.address, "10" + rad);
            await vat.rely(signer1.address);
            await vat.connect(signer1).grab(collateral, deployer.address, deployer.address, vow.address, "-1" + wad, "-15" + wad);

            await expect(vow.flap()).to.be.revertedWith("Vow/insufficient-surplus");
        });
        it('flaps sikka to multisig', async function () {
            await vat.initialize();
            await sikka.initialize("97", "SIKKA", "100" + wad);
            await sikkaJoin.initialize(vat.address, sikka.address);
            await vow.initialize(vat.address, sikkaJoin.address, deployer.address);

            await vat.init(collateral);
            await vat.rely(vow.address);
            await vat.rely(sikkaJoin.address);
            await vat.hope(sikkaJoin.address);
            await vat.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("Line"), "200" + rad);
            await vat.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("line"), "200" + rad);  
            await vat.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("dust"), "10" + rad);              
            await vat.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("spot"), "100" + ray);
            await vat.slip(collateral, deployer.address, "1" + wad);
            await vat.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, "1" + wad, 0);
            await vat.connect(deployer).frob(collateral, deployer.address, deployer.address, vow.address, 0, "15" + wad);
            
            await sikkaJoin.rely(vow.address);
            await sikka.rely(sikkaJoin.address);

            await vow.flap();
            expect(await sikka.balanceOf(deployer.address)).to.be.equal("15" + wad);
        });
    });
    describe('--- cage()', function () {
        it('reverts: Vow/not-live', async function () {
            await vat.initialize();
            await sikka.initialize("97", "SIKKA", "100" + wad);
            await sikkaJoin.initialize(vat.address, sikka.address);
            await vow.initialize(vat.address, sikkaJoin.address, deployer.address);
            
            await vow.cage();
            await expect(vow.cage()).to.be.revertedWith("Vow/not-live");
        });
    });
});