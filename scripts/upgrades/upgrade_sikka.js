const {ethers, upgrades} = require("hardhat");
const { upgradeProxy , deployImplementatoin , verifyImpContract} = require("./utils/upgrade_utils")
const { _chainId } = require(`../${hre.network.name}_config.json`);

const main = async () => {
    let sikkaProxy;
    if (hre.network.name == "polygon") {
        sikkaProxy = "0x00658FC8ec685727F3F59d381B8Ad8f5E0FeDBc2";
    } else if (hre.network.name == "mumbai") {
        sikkaProxy = "0xf268aEEAbcf96F97C928B81d662430B7659e752e";
    }
    
    // deploy Implementation
    const impAddress = await deployImplementatoin("Sikka");

    // upgrade Proxy
    await upgradeProxy(sikkaProxy, impAddress);

    // update_domainSeparator
    let Sikka = await hre.ethers.getContractFactory("Sikka");
    let sikka = await Sikka.attach(sikkaProxy);
    await (await sikka.updateDomainSeparator(_chainId)).wait();

    console.log("Verifying Imp contract...")
    await verifyImpContract(impAddress);
    
};

main()
  .then(() => {
    console.log("Success");
  })
  .catch((err) => {
    console.log(err);
  });