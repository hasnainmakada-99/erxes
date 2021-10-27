const commonFields = `
brandId
name
kind
brand {
  _id
  name
  code
}
tags {
  _id
  name
  colorCode
}
isActive
`;

const posCommonFields = `
_id
name
description
createdAt
integrationId
adminIds
cashierIds
integration {
    brandId
    brand {
        _id
        name
        code
    }
    isActive
    tags {
        _id
        name
        colorCode
    }
}
user {
    _id
    details {
        avatar
        fullName
    }
}
waitingScreen
kitchenScreen
kioskMachine
formSectionTitle
formIntegrationIds
`;

const posList = `
query posList(
  $page: Int
  $perPage: Int
  $brandId: String
  $tag: String
  $status: String
  $sortField: String
  $sortDirection: Int
) {
  posList(
    page: $page
    perPage: $perPage
    brandId: $brandId
    tag: $tag
    status: $status
    sortField: $sortField
    sortDirection: $sortDirection
  ) {
    ${posCommonFields}
  }
}

`;

const configs = `
  query posConfigs($posId: String!) {
    posConfigs(posId: $posId) {
      _id
      posId
      code
      value
    }
  }
`;

const productGroups = `
  query productGroups($posId: String!) {
    productGroups(posId: $posId) {
      _id
      posId
      name
      description
      categoryIds
      excludedCategoryIds
      excludedProductIds
    }
  }
`;

const brands = `
  query brands($page: Int, $perPage: Int, $searchValue: String) {
    brands(page: $page, perPage: $perPage, searchValue: $searchValue) {
      _id
      code
      name
      createdAt
      description
      emailConfig
    }
  }
`;

const integrationsTotalCount = `
  query integrationsTotalCount($kind: String, $tag: String, $brandId: String, $status: String){
    integrationsTotalCount(kind:$kind, tag:$tag, brandId: $brandId, status: $status){
      byKind
      byTag
      byBrand
      byStatus
      total
    }
  }
`;

const posDetail = `
query posDetail($_id: String!) {
  posDetail(_id: $_id) {
    ${posCommonFields}
    productDetails
  }
}
`;

const getDbSchemaLabels = `
  query getDbSchemaLabels($type: String) {
    getDbSchemaLabels(type: $type) {
      name
      label
    }
  }
`;

const tags = `
  query tagsQuery($type: String) {
    tags(type: $type) {
      _id
      name
      type
      colorCode
      createdAt
      objectCount
      totalObjectCount
      parentId
      order
      relatedIds
    }
  }
`;

export default {
  posList,
  configs,
  productGroups,
  brands,
  integrationsTotalCount,
  posDetail,
  getDbSchemaLabels,
  tags
};