import * as _ from 'underscore';
import {
  putCreateLog as commonPutCreateLog,
  putDeleteLog as commonPutDeleteLog,
  putUpdateLog as commonPutUpdateLog,
  gatherUsernames,
} from '@erxes/api-utils/src/logUtils';

import { Users, UsersGroups } from '../db/models/index';
import { IUserDocument } from '../db/models/definitions/users';
import messageBroker from '../messageBroker';
import { MODULE_NAMES } from './constants';

import { registerOnboardHistory } from './utils';

export type LogDesc = {
  [key: string]: any;
} & { name: any };

/**
 * @param object - Previous state of the object
 * @param newData - Requested update data
 * @param updatedDocument - State after any updates to the object
 */
export interface ILogDataParams {
  type: string;
  description?: string;
  object: any;
  newData?: object;
  extraDesc?: object[];
  updatedDocument?: any;
}

export interface IActivityLogQueryParams {
  contentId?: any;
  contentType?: string;
  action?: any;
}

interface IDescriptions {
  description?: string;
  extraDesc?: LogDesc[];
}

interface IDescriptionParams {
  action: string;
  type: string;
  obj: any;
  updatedDocument?: any;
}

const gatherUserFieldNames = async (
  doc: IUserDocument,
  prevList?: LogDesc[]
): Promise<LogDesc[]> => {
  let options: LogDesc[] = [];

  if (prevList) {
    options = prevList;
  }

  // show only user group names of users for now
  options = await gatherUsernames({
    foreignKey: 'groupIds',
    prevList: options,
    items: await UsersGroups.find({ _id: { $in: doc.groupIds } }).lean(),
  });

  return options;
};

const gatherDescriptions = async (
  params: IDescriptionParams
): Promise<IDescriptions> => {
  const { obj, action, type, updatedDocument } = params;

  let extraDesc: LogDesc[] = [];
  let description = '';

  switch (type) {
    case MODULE_NAMES.BRAND:
      {
        description = `"${obj.name}" has been ${action}d`;

        if (obj.userId) {
          const user = await Users.findOne({ _id: obj.userId });

          if (user) {
            extraDesc.push({
              userId: obj.userId,
              name: user.username || user.email,
            });
          }
        }
      }
      break;
    case MODULE_NAMES.PERMISSION:
      description = `Permission of module "${obj.module}", action "${obj.action}" assigned to `;

      if (obj.groupId) {
        const group = await UsersGroups.getGroup(obj.groupId);

        description = `${description} user group "${group.name}" `;

        extraDesc.push({ groupId: obj.groupId, name: group.name });
      }

      if (obj.userId) {
        const permUser = await Users.getUser(obj.userId);

        description = `${description} user "${permUser.email}" has been ${action}d`;

        extraDesc.push({
          userId: obj.userId,
          name: permUser.username || permUser.email,
        });
      }

      break;
    case MODULE_NAMES.USER:
      description = `"${obj.username || obj.email}" has been ${action}d`;

      extraDesc = await gatherUserFieldNames(obj);

      if (updatedDocument) {
        extraDesc = await gatherUserFieldNames(updatedDocument, extraDesc);
      }

      break;
    default:
      break;
  }

  return { extraDesc, description };
};

/**
 * Prepares a create log request to log server
 * @param params Log document params
 * @param user User information from mutation context
 */
export const putCreateLog = async (
  params: ILogDataParams,
  user: IUserDocument
) => {
  await registerOnboardHistory({ type: `${params.type}Create`, user });

  // await sendToWebhook(LOG_ACTIONS.CREATE, params.type, params);

  const { extraDesc, description } = await gatherDescriptions({
    ...params,
    obj: params.object,
    action: 'create',
  });

  return commonPutCreateLog(
    messageBroker(),
    { ...params, extraDesc, description, type: `core:${params.type}` },
    user
  );
};

/**
 * Prepares a create log request to log server
 * @param params Log document params
 * @param user User information from mutation context
 */
export const putUpdateLog = async (
  params: ILogDataParams,
  user: IUserDocument
) => {
  // await sendToWebhook(LOG_ACTIONS.UPDATE, params.type, params);

  const { extraDesc, description } = await gatherDescriptions({
    ...params,
    obj: params.object,
    action: 'update',
  });

  return commonPutUpdateLog(
    messageBroker(),
    { ...params, type: `core:${params.type}`, extraDesc, description },
    user
  );
};

/**
 * Prepares a create log request to log server
 * @param params Log document params
 * @param user User information from mutation context
 */
export const putDeleteLog = async (
  params: ILogDataParams,
  user: IUserDocument
) => {
  // await sendToWebhook(LOG_ACTIONS.DELETE, params.type, params);

  const { extraDesc, description } = await gatherDescriptions({
    ...params,
    obj: params.object,
    action: 'delete',
  });

  return commonPutDeleteLog(
    messageBroker(),
    { ...params, type: `core:${params.type}`, description, extraDesc },
    user
  );
};

export const sendToLog = (channel: string, data) =>
  messageBroker().sendMessage(channel, data);