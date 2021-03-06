import * as sinon from 'sinon';
import * as assert from 'assert';
import { fail } from 'assert';
import auth from './AadAuth';
import Auth, { Service } from '../../Auth';
import Utils from '../../Utils';
import { CommandError } from '../../Command';

describe('AadAuth', () => {
  it('restores all persisted connection properties', (done) => {
    const persistedConnection = {
      accessToken: 'abc',
      connected: true,
      resource: 'https://graph.windows.net',
      expiresAt: 123,
      refreshToken: 'def'
    };
    auth.service = new Service('https://graph.windows.net');
    sinon.stub(auth as any, 'getServiceConnectionInfo').callsFake(() => Promise.resolve(persistedConnection));
    auth
      .restoreAuth()
      .then(() => {
        try {
          assert.equal(auth.service.accessToken, persistedConnection.accessToken);
          assert.equal(auth.service.connected, persistedConnection.connected);
          assert.equal(auth.service.resource, persistedConnection.resource);
          assert.equal(auth.service.expiresAt, persistedConnection.expiresAt);
          assert.equal(auth.service.refreshToken, persistedConnection.refreshToken);
          done();
        }
        catch (e) {
          done(e);
        }
        finally {
          Utils.restore((auth as any).getServiceConnectionInfo);
        }
      });
  });

  it('continues when restoring connection information fails', (done) => {
    sinon.stub(auth as any, 'getServiceConnectionInfo').callsFake(() => Promise.reject('An error has occurred'));
    auth
      .restoreAuth()
      .then(() => {
        Utils.restore((auth as any).getServiceConnectionInfo);
        done();
      }, () => {
        Utils.restore((auth as any).getServiceConnectionInfo);
        fail('Expected promise resolve but rejected instead');
      });
  });

  it('reuses existing token if still valid', (done) => {
    const stdout = {
      log: (msg: string) => { }
    };
    auth.service = new Service('https://graph.windows.net');
    auth.service.accessToken = 'ABC';
    auth.service.expiresAt = (new Date().getTime() / 1000) + 60;
    const authEnsureAccessTokenSpy = sinon.spy(Auth.prototype, 'ensureAccessToken');
    auth
      .ensureAccessToken('https://graph.windows.net', stdout)
      .then((accessToken) => {
        try {
          assert.equal(accessToken, 'ABC');
          assert(authEnsureAccessTokenSpy.notCalled);
          done();
        }
        catch (e) {
          done(e);
        }
        finally {
          Utils.restore(Auth.prototype.ensureAccessToken);
        }
      });
  });

  it('retrieves new access token if previous token expired', (done) => {
    const stdout = {
      log: (msg: string) => { }
    };
    auth.service = new Service('https://graph.windows.net');
    auth.service.accessToken = 'ABC';
    auth.service.expiresAt = (new Date().getTime() / 1000) - 60;
    sinon.stub(Auth.prototype, 'ensureAccessToken').callsFake(() => Promise.resolve('DEF'));
    sinon.stub(auth as any, 'setServiceConnectionInfo').callsFake(() => Promise.resolve());
    auth
      .ensureAccessToken('https://graph.windows.net', stdout)
      .then((accessToken) => {
        try {
          assert.equal(accessToken, 'DEF');
          done();
        }
        catch (e) {
          done(e);
        }
        finally {
          Utils.restore([
            Auth.prototype.ensureAccessToken,
            (auth as any).setServiceConnectionInfo
          ]);
        }
      });
  });

  it('retrieves new access token if no token for the specified resource available', (done) => {
    const stdout = {
      log: (msg: string) => { }
    };
    auth.service = new Service('https://graph.windows.net');
    sinon.stub(Auth.prototype, 'ensureAccessToken').callsFake(() => Promise.resolve('DEF'));
    sinon.stub(auth as any, 'setServiceConnectionInfo').callsFake(() => Promise.resolve());
    auth
      .ensureAccessToken('https://graph.windows.net', stdout)
      .then((accessToken) => {
        try {
          assert.equal(accessToken, 'DEF');
          done();
        }
        catch (e) {
          done(e);
        }
        finally {
          Utils.restore([
            Auth.prototype.ensureAccessToken,
            (auth as any).setServiceConnectionInfo
          ]);
        }
      });
  });

  it('doesn\'t fail if persisting connection state fails', (done) => {
    const stdout = {
      log: (msg: string) => { }
    };
    auth.service = new Service('https://graph.windows.net');
    sinon.stub(Auth.prototype, 'ensureAccessToken').callsFake(() => Promise.resolve('DEF'));
    sinon.stub(auth as any, 'setServiceConnectionInfo').callsFake(() => Promise.reject('An error has occurred'));
    auth
      .ensureAccessToken('https://graph.windows.net', stdout)
      .then((accessToken) => {
        try {
          assert.equal(accessToken, 'DEF');
          done();
        }
        catch (e) {
          done(e);
        }
        finally {
          Utils.restore([
            Auth.prototype.ensureAccessToken,
            (auth as any).setServiceConnectionInfo
          ]);
        }
      });
  });

  it('logs error when persisting connection state fails and running in debug mode', (done) => {
    const stdout = {
      log: (msg: string) => { }
    };
    auth.service = new Service('https://graph.windows.net');
    const stdoutLogSpy = sinon.spy(stdout, 'log');
    sinon.stub(Auth.prototype, 'ensureAccessToken').callsFake(() => Promise.resolve('DEF'));
    sinon.stub(auth as any, 'setServiceConnectionInfo').callsFake(() => Promise.reject('An error has occurred'));
    auth
      .ensureAccessToken('https://graph.windows.net', stdout, true)
      .then((accessToken) => {
        try {
          assert(stdoutLogSpy.calledWith(new CommandError('An error has occurred')));
          done();
        }
        catch (e) {
          done(e);
        }
        finally {
          Utils.restore([
            Auth.prototype.ensureAccessToken,
            (auth as any).setServiceConnectionInfo
          ]);
        }
      });
  });

  it('fails if retrieving a new access token failed', (done) => {
    const stdout = {
      log: (msg: string) => { }
    };
    auth.service = new Service('https://graph.windows.net');
    sinon.stub(Auth.prototype, 'ensureAccessToken').callsFake(() => Promise.reject('An error has occurred'));
    auth
      .ensureAccessToken('https://graph.windows.net', stdout, true)
      .then(() => {
        Utils.restore([
          Auth.prototype.ensureAccessToken,
          (auth as any).setServiceConnectionInfo
        ]);
        fail('Failure expected but passed');
      }, (error: any) => {
        try {
          assert.equal(error, 'An error has occurred');
          done();
        }
        catch (e) {
          done(e);
        }
        finally {
          Utils.restore([
            Auth.prototype.ensureAccessToken,
            (auth as any).setServiceConnectionInfo
          ]);
        }
      });
  });

  it('stores connection info for the AAD service', () => {
    const authSetServiceConnectionInfoStub = sinon.stub(auth as any, 'setServiceConnectionInfo').callsFake(() => Promise.resolve());
    const site = new Service('https://graph.windows.net');
    auth.storeConnectionInfo();
    try {
      assert(authSetServiceConnectionInfoStub.calledWith('AAD', site));
    }
    catch (e) {
      throw e;
    }
    finally {
      Utils.restore((auth as any).setServiceConnectionInfo);
    }
  });

  it('clears connection info for the AAD service', () => {
    const authClearServiceConnectionInfoStub = sinon.stub(auth as any, 'clearServiceConnectionInfo').callsFake(() => Promise.resolve());
    auth.clearConnectionInfo();
    try {
      assert(authClearServiceConnectionInfoStub.calledWith('AAD'));
    }
    catch (e) {
      throw e;
    }
    finally {
      Utils.restore((auth as any).clearServiceConnectionInfo);
    }
  });
});