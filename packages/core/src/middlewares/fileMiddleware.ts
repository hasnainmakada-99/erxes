import * as formidable from 'formidable';
import * as request from 'request';
import * as _ from 'underscore';
import { filterXSS } from 'xss';

import {
  checkFile,
  frontendEnv,
  getSubServiceDomain,
  uploadFile
} from '../data/utils';
import { debugExternalApi } from '../debuggers';

export const uploader = async (req: any, res, next) => {
  const INTEGRATIONS_API_DOMAIN = getSubServiceDomain({
    name: 'INTEGRATIONS_API_DOMAIN'
  });

  if (req.query.kind === 'nylas') {
    debugExternalApi(`Pipeing request to ${INTEGRATIONS_API_DOMAIN}`);

    return req.pipe(
      request
        .post(`${INTEGRATIONS_API_DOMAIN}/nylas/upload`)
        .on('response', response => {
          if (response.statusCode !== 200) {
            return next(new Error(response.statusMessage));
          }

          return response.pipe(res);
        })
        .on('error', e => {
          debugExternalApi(`Error from pipe ${e.message}`);

          return next(e);
        })
    );
  }

  const form = new formidable.IncomingForm();

  form.parse(req, async (_error, _fields, response) => {
    const file = response.file || response.upload;

    // check file ====
    const status = await checkFile(file, req.headers.source);

    if (status === 'ok') {
      const API_URL = frontendEnv({ name: 'API_URL', req });
      const API_DOMAIN =
        API_URL ||
        getSubServiceDomain({
          name: 'API_DOMAIN'
        });

      try {
        const result = await uploadFile(
          API_DOMAIN,
          file,
          response.upload ? true : false
        );

        return res.send(result);
      } catch (e) {
        return res.status(500).send(filterXSS(e.message));
      }
    }

    return res.status(500).send(status);
  });
};