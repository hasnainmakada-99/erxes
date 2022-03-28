import { getFullDate, getTomorrow } from "../utils";

export const paginate = (
  collection,
  params: {
    ids?: string[];
    page?: number;
    perPage?: number;
    excludeIds?: boolean;
  }
) => {
  const { page = 0, perPage = 0, ids, excludeIds } = params || { ids: null };

  const _page = Number(page || "1");
  const _limit = Number(perPage || "100");

  if (ids && ids.length > 0) {
    return excludeIds ? collection.limit(_limit) : collection;
  }

  return collection.limit(_limit).skip((_page - 1) * _limit);
};

export const escapeRegExp = (str: string) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const generateFilterQuery = async (
  models,
  { brandId, tag, status, isOnline },
  commonQuerySelector
) => {
  const query: any = commonQuerySelector;
  const integrationQuery: any = { kind: 'pos' };

  if (brandId) {
    integrationQuery.brandId = brandId;
  }

  if (tag) {
    const object = await models.Tags.findOne({ _id: tag });
    integrationQuery.tagIds = { $in: [tag, ...(object?.relatedIds || [])] };
  }

  if (status) {
    query.isActive = status === 'active' ? true : false;
  }

  if (isOnline) {
    query.isOnline = isOnline === 'online'
  }

  const posIntegrations = await models.Integrations.find(integrationQuery, {
    _id: 1
  });

  query.integrationId = { $in: posIntegrations.map(e => e._id) };

  return query;
};

const generateFilterPosQuery = async (
  _models, params, commonQuerySelector, currentUserId
) => {
  const query: any = commonQuerySelector;
  const {
    search,
    paidStartDate,
    paidEndDate,
    createdStartDate,
    createdEndDate,
    paidDate,
    userId,
    customerId
  } = params;

  if (search) {
    query.number = { $regex: new RegExp(search) }
  }

  if (customerId) {
    query.customerId = customerId
  }

  if (userId) {
    let lastUserId = userId
    if (userId === 'me') {
      lastUserId = currentUserId;
    }
    if (userId === 'nothing') {
      lastUserId = ''
    }
    query.userId = lastUserId
  }

  const paidQry: any = {}
  if (paidStartDate) {
    paidQry.$gte = new Date(paidStartDate)
  }
  if (paidEndDate) {
    paidQry.$lte = new Date(paidEndDate)
  }
  if (Object.keys(paidQry).length) {
    query.paidDate = paidQry
  }

  if (paidDate === 'today') {
    const now = new Date()

    const startDate = getFullDate(now)
    const endDate = getTomorrow(now)
    query.paidDate = { $gte: startDate, $lte: endDate }
  }

  const createdQry: any = {}
  if (createdStartDate) {
    createdQry.$gte = new Date(createdStartDate)
  }
  if (createdEndDate) {
    createdQry.$lte = new Date(createdEndDate)
  }
  if (Object.keys(createdQry).length) {
    query.createdAt = createdQry
  }

  return query
}

const queries = [
  /**
   * all pos list
   */
  {
    name: 'posList',
    handler: async (
      _root,
      params,
      { commonQuerySelector, models, checkPermission, user }
    ) => {
      await checkPermission('showPos', user);

      const query = await generateFilterQuery(
        models,
        params,
        commonQuerySelector
      );

      const posList = paginate(models.Pos.find(query), params);

      return posList;
    }
  },
  {
    name: 'posDetail',
    handler: async (_root, { _id }, { models, checkPermission, user }) => {
      await checkPermission('showPos', user);
      return await models.Pos.getPos(models, { _id });
    }
  },
  {
    name: 'ecommerceGetBranches',
    handler: async (_root, { posToken }, { models, messageBroker }) => {
      const pos = await models.Pos.findOne({ token: posToken }).lean();

      if (!pos) {
        return { error: 'not found pos' }
      }

      const allowsPos = await models.Pos.find({ isOnline: { $ne: true }, branchId: { $in: pos.allowBranchIds } }).lean();

      const healthyBranchIds = []

      for (const allowPos of allowsPos) {
        const syncIds = Object.keys(allowPos.syncInfos || {}) || [];

        if (!syncIds.length) {
          continue;
        }

        for (const syncId of syncIds) {
          const syncDate = allowPos.syncInfos[syncId];

          // expired sync 72 hour
          if ((new Date().getTime() - syncDate.getTime()) / (60 * 60 * 1000) > 72) {
            continue;
          }

          const longTask = async () => (
            await messageBroker().sendRPCMessage(`rpc_queue:health_check_${syncId}`, {})
          );

          const timeout = (cb, interval) => () =>
            new Promise(resolve => setTimeout(() => cb(resolve), interval))

          const onTimeout = timeout(resolve =>
            resolve({}), 3000)

          let response = { healthy: 'down' };
          await Promise.race([longTask, onTimeout].map(f => f())).then((result) => response = result)

          if (response.healthy === 'ok') {
            healthyBranchIds.push(allowPos.branchId)
            break;
          }
        }
      }

      return await models.Branches.find({ _id: { $in: healthyBranchIds } }).lean();
    }
  },
  {
    name: 'productGroups',
    handler: async (
      _root,
      { posId }: { posId: string },
      { models, checkPermission, user }
    ) => {
      await checkPermission('managePos', user);
      return await models.ProductGroups.groups(models, posId);
    }
  },

  {
    name: 'posOrders',
    handler: async (_root, params, { models, commonQuerySelector, user }) => {
      const query = await generateFilterPosQuery(models, params, commonQuerySelector, user._id)

      return paginate(models.PosOrders.find(query), {
        page: params.page,
        perPage: params.perPage
      });
    }
  },
  {
    name: 'posOrderDetail',
    handler: async (_root, { _id }, { models }) => {
      const order = await models.PosOrders.findOne({ _id }).lean();
      const productIds = order.items.map(i => i.productId);
      const products = await models.Products.find({ _id: { $in: productIds } }, { name: 1 }).lean();

      const productById = {}
      for (const product of products) {
        productById[product._id] = product;
      }

      for (const item of order.items) {
        item.productName = (productById[item.productId] || {}).name || 'unknown';
      }

      order.putResponses = await models.PutResponses.find({ contentType: 'pos', contentId: order._id }).lean();

      return order;
    }
  },
  {
    name: 'posOrdersSummary',
    handler: async (_root, params, { models, commonQuerySelector, user }) => {
      const query = await generateFilterPosQuery(models, params, commonQuerySelector, user._id)

      const res = await models.PosOrders.aggregate([
        { $match: { ...query } },
        {
          $project: {
            cardAmount: '$cardAmount',
            cashAmount: '$cashAmount',
            mobileAmount: '$mobileAmount',
            totalAmount: '$totalAmount',
            finalAmount: '$finalAmount ',
          }
        },
        {
          $group: {
            _id: '',
            cardAmount: { $sum: '$cardAmount' },
            cashAmount: { $sum: '$cashAmount' },
            mobileAmount: { $sum: '$mobileAmount' },
            totalAmount: { $sum: '$totalAmount' },
            finalAmount: { $sum: '$finalAmount ' },
          }
        }
      ]);

      if (!res.length) {
        return {}
      }

      return {
        ...res[0],
        count: await models.PosOrders.find(query).countDocuments()
      }

    }
  },
  {
    name: 'posProducts',
    handler: async (_root, params, { models, commonQuerySelector, user }) => {
      const orderQuery = await generateFilterPosQuery(models, params, commonQuerySelector, user._id);
      const query: any = { status: { $ne: 'deleted' } };

      if (params.categoryId) {
        const category = await models.ProductCategories.getProductCatogery({
          _id: params.categoryId,
          status: { $in: [null, 'active'] }
        });

        const product_category_ids = await models.ProductCategories.find(
          { order: { $regex: new RegExp(category.order) } },
          { _id: 1 }
        ).lean();

        query.categoryId = { $in: product_category_ids }
      }

      if (params.searchValue) {
        const fields = [
          {
            name: { $in: [new RegExp(`.*${escapeRegExp(params.searchValue)}.*`, 'i')] }
          },
          { code: { $in: [new RegExp(`.*${escapeRegExp(params.searchValue)}.*`, 'i')] } }
        ];

        query.$or = fields;
      }
      const limit = params.perPage || 20;
      const skip = params.page ? (params.page - 1) * limit : 0;

      const products = await models.Products.find(query)
        .skip(skip).limit(limit).lean();

      const totalCount = await models.Products.find(query).countDocuments();

      const productIds = products.map(p => p._id)

      query['items.productId'] = { $in: productIds }

      const items = await models.PosOrders.aggregate([
        { $match: orderQuery },
        { $unwind: '$items' },
        { $match: { 'items.productId': { $in: productIds } } },
        {
          $project: {
            productId: '$items.productId',
            count: '$items.count',
          }
        },
        {
          $group: {
            _id: '$productId',
            count: { $sum: '$count' },
          }
        }
      ]);

      for (const product of products) {
        product.count = (items.find(i => i._id === product._id) || {}).count || 0;
      }

      return { totalCount, products };
    }
  },

  // delivery information from clientPortal
  {
    name: 'ordersDeliveryInfo',
    handler: async (
      _root,
      { orderId },
      { models }
    ) => {
      const order = await models.PosOrders.findOne({ _id: orderId }).lean();

      // on kitchen
      if (!order.deliveryInfo) {
        throw new Error('Deleted delivery information.')
      }

      if (!order.deliveryInfo.dealId) {
        return {
          _id: order._id,
          status: 'onKitchen',
          date: order.paidDate
        }
      }

      const dealId = order.deliveryInfo.dealId;
      const deal = await models.Deals.findOne({ _id: dealId }).lean();

      if (!deal) {
        throw new Error('Deleted delivery information.')
      }

      const stage = await models.Stages.findOne({ _id: deal.stageId }).lean();

      return {
        _id: order._id,
        status: stage.name,
        date: deal.stageChangedDate || deal.modifiedDate || deal.createdAt
      };
    }

  },
  {
    name: 'cpPosOrders',
    handler: async (_root, params, { models, commonQuerySelector }) => {
      const query = await generateFilterPosQuery(models, params, commonQuerySelector, '')

      return paginate(models.PosOrders.find(query).sort({ createdAt: -1 }), {
        page: params.page,
        perPage: params.perPage
      });
    }
  },
];

export default queries;
