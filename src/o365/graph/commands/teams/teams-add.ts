import auth from '../../GraphAuth';
import config from '../../../../config';
import commands from '../../commands';
import GlobalOptions from '../../../../GlobalOptions';
import {
  CommandOption, CommandValidate
} from '../../../../Command';
import Utils from '../../../../Utils';
import GraphCommand from '../../GraphCommand';
import * as request from 'request-promise-native';
const vorpal: Vorpal = require('../../../../vorpal-init');

interface CommandArgs {
  options: Options;
}

interface Options extends GlobalOptions {
  groupId?: string;
  name?: string;
  description?: string;
}

class GraphTeamsAddCommand extends GraphCommand {
  public get name(): string {
    return `${commands.TEAMS_ADD}`;
  }

  public get description(): string {
    return 'Add a new Microsoft Teams team.';
  }

  public getTelemetryProperties(args: CommandArgs): any {
    const telemetryProps: any = super.getTelemetryProperties(args);
    telemetryProps.groupId = typeof args.options.groupId !== 'undefined';
    telemetryProps.name = typeof args.options.name !== 'undefined';
    telemetryProps.description = typeof args.options.description !== 'undefined';
    return telemetryProps;
  }

  public commandAction(cmd: CommandInstance, args: CommandArgs, cb: () => void): void {
    auth
      .ensureAccessToken(auth.service.resource, cmd, this.debug)
      .then((): request.RequestPromise => {
        return args.options.groupId ? this.CreateTeamForGroup(cmd,args) : 
                                      this.CreateTeam(cmd,args);
      })
      .then((res: any): void => {
        // get the teams id from the response header.
        const teamsRspHdrRegEx : any = /teams?\('([^']+)'\)/i.exec(res.headers.location);

        if(teamsRspHdrRegEx != null && teamsRspHdrRegEx.length > 0)
        {
          cmd.log(teamsRspHdrRegEx[1]);
        }

        if (this.verbose) {
          cmd.log(vorpal.chalk.green('DONE'));
        }
        cb();
      }, (err: any): void =>{ 
        this.handleRejectedODataJsonPromise(err, cmd, cb)
      });
  }

  private CreateTeam(cmd : CommandInstance, args: CommandArgs) : request.RequestPromise {
    const teamsEndpoint: string = `${auth.service.resource}/beta/teams`;
    const teamsRequestBody = {
      'template@odata.bind': 'https://graph.microsoft.com/beta/teamsTemplates/standard',
      displayName: args.options.name,
      description: args.options.description
    };


    const requestOptions: any = {
      url: teamsEndpoint,
      resolveWithFullResponse: true ,
      headers: Utils.getRequestHeaders({
        authorization: `Bearer ${auth.service.accessToken}`,
        accept: 'application/json;odata.metadata=none',
        'content-type': 'application/json;odata=nometadata'
      }),
      body: teamsRequestBody,
      json: true
    };

    if (this.debug) {
      cmd.log('Executing web request...');
      cmd.log(requestOptions);
      cmd.log('');
    }

    return request.post(requestOptions);
  }

  private CreateTeamForGroup(cmd : CommandInstance, args: CommandArgs) : request.RequestPromise {
    const groupTeamsEndpoint: string = `${auth.service.resource}/beta/groups/${args.options.groupId}/team`;
   
    const requestOptions: any = {
      url: groupTeamsEndpoint,
      resolveWithFullResponse: true ,
      headers: Utils.getRequestHeaders({
        authorization: `Bearer ${auth.service.accessToken}`,
        accept: 'application/json;odata.metadata=none',
        'content-type': 'application/json;odata=nometadata'
      }),
      body: {},
      json: true
    };

    if (this.debug) {
      cmd.log('Executing web request...');
      cmd.log(requestOptions);
      cmd.log('');
    }

    return request.put(requestOptions);
  }

  public options(): CommandOption[] {
    const options: CommandOption[] = [
      {
        option: '-n, --name [name]',
        description: 'Display name for the Microsoft Teams team. It is not required, if groupId is specified.'
      },
      {
        option: '-d, --description [description]',
        description: 'Description for the Microsoft Teams team'
      },
      {
        option: '-i, --groupId [groupId]',
        description: 'The ID of the O365 group to add a Microsoft Teams team'
      }
    ];

    const parentOptions: CommandOption[] = super.options();
    return options.concat(parentOptions);
  }

  public validate(): CommandValidate {
    return (args: CommandArgs): boolean | string => {

      if(!args.options.groupId)
      {
        if(!args.options.name) {
          return `Required parameter name missing`
        }
        if(!args.options.description) {
          return `Required parameter description missing`
        }
      }
      else 
      {
        if (args.options.name || args.options.description) {
          return `Please specify either a groupId or Name`;
        }
  
        if (!Utils.isValidGuid(args.options.groupId as string)) {
          return `${args.options.groupId} is not a valid GUID`;
        }
      }
     
      return true;
    };
  }

  public commandHelp(args: {}, log: (help: string) => void): void {
    const chalk = vorpal.chalk;
    log(vorpal.find(this.name).helpInformation());
    log(
      `  ${chalk.yellow('Important:')} before using this command, log in to the Microsoft Graph
    using the ${chalk.blue(commands.LOGIN)} command.
        
  Remarks:
    ${chalk.yellow('Attention:')} This command is based on a Microsoft Graph API that is currently
    in preview and is subject to change once the API reached general
    availability.

    To add a new Microsoft Teams team, you have to first
    log in to the Microsoft Graph using the ${chalk.blue(commands.LOGIN)} command,
    eg. ${chalk.grey(`${config.delimiter} ${commands.LOGIN}`)}.

  Examples:
  
    Add a new Microsoft Teams team by creating a group 
      ${chalk.grey(config.delimiter)} ${this.name} --name 'Architecture' --description 'Architecture Discussion'
    Add a new Microsoft Teams team for a group 
      ${chalk.grey(config.delimiter)} ${this.name} --groupId 6d551ed5-a606-4e7d-b5d7-36063ce562cc
  `);
  }
}

module.exports = new GraphTeamsAddCommand();