import GenericProvider from './genericProvider.js';
import AutomateProvider from './automateProvider.js';

export default class ProviderResolver {
  static resolve(sessionId, commandExecutorUrl, capabilities, sessionCapabilities, clientInfo, environmentInfo, options) {
    // We can safely do [0] because GenericProvider is catch all
    // console.log(capabilities?.desired?.platformName?.lower());
    // if (['android', 'ios'].includes(capabilities?.desired?.platformName?.lower())) {
    //   return new GenericProvider(sessionId, commandExecutorUrl, capabilities, sessionCapabilities, clientInfo, environmentInfo, options);
    // }
    return new GenericProvider(sessionId, commandExecutorUrl, capabilities, sessionCapabilities, clientInfo, environmentInfo, options);
    // const Klass = [AutomateProvider, GenericProvider].filter(x => x.supports(commandExecutorUrl))[0];
    // return new Klass(sessionId, commandExecutorUrl, capabilities, sessionCapabilities, clientInfo, environmentInfo, options);
  }
}
