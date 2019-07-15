const MyERC20 = require('Embark/contracts/MyERC20');
// const Web3 = require('web3');
// const BigNumber = Web3.BigNumber;
// const BigNumber = require('bn.js');
// const BigNumber = web3.utils.BN; //Ethers.BigNumber;
const BigNumber = web3.BigNumber;
// const a = Web3.Ethers.BigNumber;
const mlog = require('mocha-logger');
const util = require('util');

require('chai')
  .use(require('chai-bignumber')(BigNumber))
  .should();

let accounts;

// For documentation please see https://embark.status.im/docs/contracts_testing.html
config({
  //deployment: {
  //  accounts: [
  //    // you can configure custom accounts with a custom balance
  //    // see https://embark.status.im/docs/contracts_testing.html#Configuring-accounts
  //  ]
  //},
  contracts: {
    "MyERC20": {
      args: []
    }
  }
}, (_err, web3_accounts) => {
  accounts = web3_accounts
});

contract("MyERC20", function () {
  this.timeout(0);

  const TOKEN_COUNT = 1000000;

  describe('Given that I have a Token Contract', () => {
    it('it should have the correct name', async () => {
      const name = await MyERC20.name();
      name.should.be.equal("Hello ERC20 Coin");
    });
    it('it should have the correct symbol', async () => {
      const symbol = await MyERC20.symbol();
      symbol.should.be.equal("HE2");
    });
    it('it should have the correct decimal level', async () => {
      const decimals = await MyERC20.decimals();
      decimals.should.be.bignumber.equal(18);
    });

    describe('Given that I have a fixed supply of tokens', () => {
      it('it should return the total supply of tokens for the Contract', async () => {
        const supply = await MyERC20.totalSupply();
        supply.should.be.bignumber.equal(toWei(TOKEN_COUNT));
      });
      it('the owner should have all the tokens when the Contract is created', async () => {
        let owner = accounts[0];
        const balance = await MyERC20.methods.balanceOf(owner).call();
        balance.should.be.bignumber.equal(toWei(TOKEN_COUNT));
      });
      it('any account should have the tokens transfered to it', async () => {
        let holder = accounts[1];
        const amount = toWei(TOKEN_COUNT - 10);
        await MyERC20.transfer(holder, amount).send({ from: owner });
        const balance = await MyERC20.methods.balanceOf(holder).call();
        balance.should.be.bignumber.equal(amount);
      });
      it('an address that has no tokens should return a balance of zero', async () => {
        const balance = await MyERC20.methods.balanceOf("0x0000000000000000000000000000000000000000").call();
        balance.should.be.bignumber.equal(0);
      });
    
      describe('Given that I want to be able to transfer tokens', () => {
        it('it should not let me transfer tokens to myself', async () => {
          var hasError = true;
          try {
            const amount = toWei(10);
            await MyERC20.transfer(owner, amount).send({ from: owner })
            hasError = false; // Should be unreachable
          } catch (err) { }
          assert.equal(true, hasError, "Function not throwing exception on transfer to self");
        });
        it('it should not let someone transfer tokens they do not have', async () => {
          let owner = accounts[0];
          let holder = accounts[1];
          var hasError = true;
          try {
            await MyERC20.transfer(holder, toWei(10)).send({ from: owner })
            await MyERC20.transfer(receiver, toWei(20)).send({ from: holder })
            hasError = false;
          } catch (err) { }
          assert.equal(true, hasError, "Insufficient funds");
        });
        it('it should emit a Transfer Event', async () => {
          let owner = accounts[0];
          let holder = accounts[1];
          const amount = toWei(10);
          const { events } = await MyERC20.methods.transfer(holder, amount).send({ from: owner });

          assert.ok(events.Transfer, 'No Transfer Event emitted');
          assert.equal(Object.keys(events)[0], 'Transfer');
          // assert.equal(events.Transfer.returnvalues.from, owner);
          // assert.equal(events.Transfer.returnvalues.Result.to, holder);
          // assert.equal(events.Transfer.returnvalues.Result.tokens, amount);
        });

        describe('Given that I want to allow the transfer of tokens by a third party', () => {
          it('allowance should return the amount I allow them to transfer', async () => {
            let owner = accounts[0];
            let holder = accounts[1];
            const amount = toWei(99);
            await MyERC20.approve(holder, amount, { from: owner });
            const remaining = await MyERC20.methods.allowance(owner, holder).call();
            remaining.should.be.bignumber.equal(amount);
          });
          it('allowance should return the amount another allows a third account to transfer', async () => {
            let owner = accounts[0];
            let holder = accounts[1];
            let receiver = accounts[2];
            const amount = toWei(98);
            await MyERC20.methods.transfer(holder, toWei(100))
            await MyERC20.methods.approve(receiver, amount).send({ from: holder });
            const remaining = await MyERC20.methods.allowance(holder, receiver).call();
            remaining.should.be.bignumber.equal(amount);
          });
          it('allowance should return zero if none have been approved for the account', async () => {
            let owner = accounts[0];
            const remaining = await MyERC20.methods.allowance(owner, "0x0000000000000000000000000000000000000000").call();
            remaining.should.be.bignumber.equal(0);
          });
          it('it should emit an Approval event when the approve method is successfully called', async () => {
            let owner = accounts[0];
            let holder = accounts[1];
            const amount = toWei(97);
            const { events } = await MyERC20.methods.approve(holder, amount).send({ from: owner });

            assert.ok(events.Approval, 'No Approval Event emitted');
            assert.equal(Object.keys(events)[0], 'Approval');
          });
          it('transferFrom should transfer tokens when triggered by an approved third party', async () => {
            let owner = accounts[0];
            let holder = accounts[1];
            let receiver = accounts[2];
            const tokenAmount = 96;
            const amount = toWei(tokenAmount);
            await MyERC20.methods.approve(holder, amount).send({ from: owner });
            await MyERC20.methods.transferFrom(owner, receiver, amount).send({ from: holder });
            const balance = await MyERC20.methods.balanceOf(receiver).call({ from: receiver });

            balance.should.be.bignumber.equal(toWei(tokenAmount));
          });
          it('the account funds are being transferred from should have sufficient funds', async () => {
            let owner = accounts[0];
            let receiver = accounts[2];
            var hasError = true;
            try {
              const balance99 = toWei(99);
              await MyERC20.transfer(accountWith99, balance99, { from: owner })
              const balance = await MyERC20.methods.balanceOf(accountWith99).call();
              balance.should.be.bignumber.equal(balance99);
              const amount = toWei(100);

              await MyERC20.methods.approve(receiver, amount).send({ from: accountWith99 });
              await MyERC20.methods.transferFrom(accountWith99, nilAddress, amount).send({ from: receiver });
              asError = false;
            } catch (err) { }
            assert.equal(true, hasError, "Function not throwing exception for insufficient funds");
          });
          it('should throw exception when attempting to transferFrom unauthorized account', async () => {
            let owner = accounts[0];
            let holder = accounts[1];
            var hasError = true;
            try {
              const remaining = await MyERC20.methods.allowance(owner, nilAddress).call();
              remaining.should.be.bignumber.equal(toWei(0));
              var holderBalance = await MyERC20.methods.balanceOf(holder).call();
              holderBalance.should.be.bignumber.equal(toWei(0));
              const amount = toWei(101);

              await MyERC20.methods.transferFrom(owner, holder, amount).send({ from: "0x0000000000000000000000000000000000000000" });
              asError = false;
            } catch (err) { }
            assert.equal(true, hasError, "Unauthorized account should not be allowed transfer funds.");
          });
          it('An authorized accounts allowance should go down when transferFrom is called', async () => {
            let owner = accounts[0];
            let holder = accounts[1];
            let receiver = accounts[2];
            const amount = toWei(15);
            await MyERC20.methods.approve(holder, amount).send({ from: owner });
            var allowance = await MyERC20.methods.allowance(owner, holder).call();
            allowance.should.be.bignumber.equal(amount);

            await MyERC20.methods.transferFrom(owner, receiver, toWei(7)).send({ from: holder });

            allowance = await MyERC20.methods.allowance(owner, holder).call();
            allowance.should.be.bignumber.equal(toWei(8));
          });
          it('it should emit a Transfer event when transferFrom is called', async () => {
            let owner = accounts[0];
            let holder = accounts[1];
            let receiver = accounts[2];
            const amount = toWei(17);
            await MyERC20.methods.approve(holder, amount).send({ from: owner });

            const { events } = await MyERC20.methods.transferFrom(owner, receiver, amount).send({ from: holder });

            assert.ok(events.Transfer, 'No Transfer Event emitted');
            assert.equal(Object.keys(events)[0], 'Transfer');
          });
        });
      });
    });
  });
});

function toWei(count) {
  return count * 10 ** 18;
}
