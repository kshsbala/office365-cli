import auth from '../../SpoAuth';
import config from '../../../../config';
import commands from '../../commands';
import * as request from 'request-promise-native';
import SpoCommand from '../../SpoCommand';
import Utils from '../../../../Utils';
import { CommandOption, CommandError, CommandValidate } from '../../../../Command';
import GlobalOptions from '../../../../GlobalOptions';
import { ContextInfo, ClientSvcResponse, ClientSvcResponseContents } from '../../spo';

const vorpal: Vorpal = require('../../../../vorpal-init');

interface CommandArgs {
  options: Options;
}

interface Options extends GlobalOptions {
  url: string;
}

class SiteAppCatalogRemoveCommand extends SpoCommand {
  public get name(): string {
    return commands.SITE_APPCATALOG_REMOVE;
  }

  public get description(): string {
    return 'Removes site collection scoped app catalog from site';
  }

  protected requiresTenantAdmin(): boolean {
    return true;
  }

  public getTelemetryProperties(args: CommandArgs): any {
    const telemetryProps: any = super.getTelemetryProperties(args);
    telemetryProps.url = (!(!args.options.url)).toString();
    return telemetryProps;
  }

  public commandAction(cmd: CommandInstance, args: CommandArgs, cb: () => void): void {
    const url: string = args.options.url;

    auth
      .ensureAccessToken(auth.service.resource, cmd, this.debug)
      .then((accessToken: string): Promise<ContextInfo> => {
        if (this.debug) {
          cmd.log(`Retrieved access token ${accessToken}. Retrieving request digest for tenant admin at ${auth.site.url}...`);
        }

        return this.getRequestDigest(cmd, this.debug);
      })
      .then((res: ContextInfo): Promise<string> => {
        if (this.debug) {
          cmd.log('Response:');
          cmd.log(res);
          cmd.log('');
        }

        if (this.verbose) {
          cmd.log(`Disabling site collection app catalog...`);
        }

        const requestOptions: any = {
          url: `${auth.site.url}/_vti_bin/client.svc/ProcessQuery`,
          headers: Utils.getRequestHeaders({
            authorization: `Bearer ${auth.service.accessToken}`,
            'X-RequestDigest': res.FormDigestValue
          }),
          body: `<Request AddExpandoFieldTypeSuffix="true" SchemaVersion="15.0.0.0" LibraryVersion="16.0.0.0" ApplicationName="${config.applicationName}" xmlns="http://schemas.microsoft.com/sharepoint/clientquery/2009"><Actions><ObjectPath Id="50" ObjectPathId="49" /><ObjectPath Id="52" ObjectPathId="51" /><ObjectPath Id="54" ObjectPathId="53" /><ObjectPath Id="56" ObjectPathId="55" /><ObjectPath Id="58" ObjectPathId="57" /><Method Name="Remove" Id="59" ObjectPathId="57"><Parameters><Parameter Type="String">${Utils.escapeXml(url)}</Parameter></Parameters></Method></Actions><ObjectPaths><Constructor Id="49" TypeId="{268004ae-ef6b-4e9b-8425-127220d84719}" /><Method Id="51" ParentId="49" Name="GetSiteByUrl"><Parameters><Parameter Type="String">${Utils.escapeXml(url)}</Parameter></Parameters></Method><Property Id="53" ParentId="51" Name="RootWeb" /><Property Id="55" ParentId="53" Name="TenantAppCatalog" /><Property Id="57" ParentId="55" Name="SiteCollectionAppCatalogsSites" /></ObjectPaths></Request>`
        };

        if (this.debug) {
          cmd.log('Executing web request...');
          cmd.log(JSON.stringify(requestOptions));
          cmd.log('');
        }

        return request.post(requestOptions);
      })
      .then((res: string): void => {
        if (this.debug) {
          cmd.log('Response:');
          cmd.log(res);
          cmd.log('');
        }

        const json: ClientSvcResponse = JSON.parse(res);
        const response: ClientSvcResponseContents = json[0];
        if (response.ErrorInfo) {
          cmd.log(new CommandError(response.ErrorInfo.ErrorMessage));
        }
        else {
          if (this.verbose) {
            cmd.log('Site collection app catalog disabled');
          }
        }
        cb();
      }, (err: any): void => this.handleRejectedPromise(err, cmd, cb));
  }

  public options(): CommandOption[] {
    const options: CommandOption[] = [
      {
        option: '-u, --url <url>',
        description: 'URL of the site collection containing the app catalog to disable'
      }
    ];

    const parentOptions: CommandOption[] = super.options();
    return options.concat(parentOptions);
  }

  public validate(): CommandValidate {
    return (args: CommandArgs): boolean | string => {
      if (!args.options.url) {
        return 'Required option url missing';
      }

      const isValidSharePointUrl: boolean | string = SpoCommand.isValidSharePointUrl(args.options.url);

      if (isValidSharePointUrl !== true) {
        return isValidSharePointUrl;
      }

      return true;
    };
  }

  public commandHelp(args: {}, log: (help: string) => void): void {
    const chalk = vorpal.chalk;
    log(vorpal.find(this.name).helpInformation());
    log(
      `  ${chalk.yellow('Important:')} before using this command, connect to a SharePoint Online tenant admin site,
      using the ${chalk.blue(commands.CONNECT)} command.
   
  Remarks:

    To remove site collection app catalogs, you have to first connect to a tenant admin site using the
    ${chalk.blue(commands.CONNECT)} command, eg. ${chalk.grey(`${config.delimiter} ${commands.CONNECT} https://contoso-admin.sharepoint.com`)}.

    While the command uses the term "remove", like the PowerShell equivalent cmdlet, it does not remove
    the special library Apps for SharePoint from the site collection. It simply disables the site
    collection app catalog in that site. Packages deployed to the app catalog are not available within
    the site collection.

  Examples:
  
    Remove a site collection app catalog to the specified site
      ${chalk.grey(config.delimiter)} ${commands.SITE_APPCATALOG_REMOVE} --url https://contoso.sharepoint.com/sites/site
      `);
  }
}

module.exports = new SiteAppCatalogRemoveCommand();