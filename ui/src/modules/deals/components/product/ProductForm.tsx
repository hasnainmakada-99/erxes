import Button from 'modules/common/components/Button';
import EmptyState from 'modules/common/components/EmptyState';
import Icon from 'modules/common/components/Icon';
import Table from 'modules/common/components/table';
import { Tabs, TabTitle } from 'modules/common/components/tabs';
import { ModalFooter } from 'modules/common/styles/main';
import { __, Alert } from 'modules/common/utils';
import { IProduct } from 'modules/settings/productService/types';
import React from 'react';
import {
  Add,
  FooterInfo,
  FormContainer,
  ProductTableWrapper
} from '../../styles';
import { IPaymentsData, IProductData } from '../../types';
import PaymentForm from './PaymentForm';
import ProductItem from './ProductItem';
import ProductTotal from './ProductTotal';
import { IProductTemplate } from '../../../settings/template/types';
import ModalTrigger from 'modules/common/components/ModalTrigger';
import TemplateForm from 'modules/settings/template/containers/product/ProductForm';
import {
  MainStyleFormColumn as FormColumn,
  MainStyleFormWrapper as FormWrapper
} from 'erxes-ui';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownToggle from 'modules/common/components/DropdownToggle';

type Props = {
  onChangeProductsData: (productsData: IProductData[]) => void;
  saveProductsData: () => void;
  onChangePaymentsData: (paymentsData: IPaymentsData) => void;
  productsData: IProductData[];
  products: IProduct[];
  paymentsData?: IPaymentsData;
  productTemplates: IProductTemplate[];
  closeModal: () => void;
  uom: string[];
  currencies: string[];
  currentProduct?: string;
};

type State = {
  total: { [currency: string]: number };
  tax: { [currency: string]: { value?: number; percent?: number } };
  discount: { [currency: string]: { value?: number; percent?: number } };
  currentTab: string;
  changePayData: { [currency: string]: number };
  tempId: string;
  saveAsTemplateStatus: boolean;
};

class ProductForm extends React.Component<Props, State> {
  constructor(props) {
    super(props);

    this.state = {
      total: {},
      discount: {},
      tax: {},
      currentTab: 'products',
      changePayData: {},
      tempId: '',
      saveAsTemplateStatus: false
    };
  }

  componentDidMount() {
    this.updateTotal();
  }

  addProductItem = () => {
    const { productsData, onChangeProductsData, currencies } = this.props;
    const { tax, discount } = this.state;
    const currency = currencies ? currencies[0] : '';

    this.setState({ tempId: Math.random().toString() }, () => {
      productsData.push({
        _id: this.state.tempId,
        quantity: 1,
        unitPrice: 0,
        tax: 0,
        taxPercent: tax[currency] ? tax[currency].percent || 0 : 0,
        discount: 0,
        discountPercent: discount[currency]
          ? discount[currency].percent || 0
          : 0,
        amount: 0,
        currency,
        tickUsed: true
      });

      onChangeProductsData(productsData);
    });

    this.setState({ saveAsTemplateStatus: true });
  };

  addProductTemplateItem = (
    product: IProduct,
    discountT: number,
    quantity: number
  ) => {
    const { productsData, onChangeProductsData, currencies } = this.props;
    const { tax } = this.state;
    const unitPrice = product ? product.unitPrice : 0;
    const discountAmount =
      discountT && discountT > 0 ? (unitPrice / 100) * discountT : 0;
    const currency = currencies ? currencies[0] : '';

    productsData.push({
      _id: Math.random().toString(),
      quantity: quantity ? quantity : 1,
      unitPrice,
      tax: 0,
      taxPercent: tax[currency] ? tax[currency].percent || 0 : 0,
      discount: discountAmount,
      discountPercent: discountT || 0,
      amount: unitPrice - discountAmount || 0,
      currency,
      tickUsed: true,
      product: product ? product : ({} as IProduct)
    });

    this.updateTotal(productsData);
    onChangeProductsData(productsData);
    // });
  };

  calculateAmount = (type: string, productData: IProductData) => {
    const amount = productData.unitPrice * productData.quantity;

    if (amount > 0) {
      if (type === 'discount') {
        productData.discountPercent = (productData.discount * 100) / amount;
      } else {
        productData.discount = (amount * productData.discountPercent) / 100;
      }

      productData.tax =
        ((amount - productData.discount || 0) * productData.taxPercent) / 100;
      productData.amount =
        amount - (productData.discount || 0) + (productData.tax || 0);
    } else {
      productData.tax = 0;
      productData.discount = 0;
      productData.amount = 0;
    }
  };

  addProductTemplate = id => {
    const templateId = id;

    const productTemplates = this.props.productTemplates || [];
    const template = productTemplates.filter(p => p._id === templateId);
    const templateItems =
      template.length > 0 ? template[0].templateItemsProduct : [];

    templateItems.forEach(item => {
      this.addProductTemplateItem(item.product, item.discount, item.quantity);
    });
  };

  removeProductItem = productId => {
    const { productsData, onChangeProductsData } = this.props;

    const removedProductsData = productsData.filter(p => p._id !== productId);

    onChangeProductsData(removedProductsData);

    this.updateTotal(removedProductsData);
  };

  updateTotal = (productsData = this.props.productsData) => {
    const total = {};
    const tax = {};
    const discount = {};

    productsData.forEach(p => {
      if (p.currency && p.tickUsed) {
        if (!total[p.currency]) {
          discount[p.currency] = { percent: 0, value: 0 };
          tax[p.currency] = { percent: 0, value: 0 };
          total[p.currency] = 0;
        }

        discount[p.currency].value += p.discount || 0;
        tax[p.currency].value += p.tax || 0;
        total[p.currency] += p.amount || 0;
      }
    });

    for (const currency of Object.keys(discount)) {
      let clearTotal = total[currency] - tax[currency].value;
      tax[currency].percent = (tax[currency].value * 100) / clearTotal;

      clearTotal = clearTotal + discount[currency].value;
      discount[currency].percent =
        (discount[currency].value * 100) / clearTotal;
    }

    this.setState({ total, tax, discount });
  };

  renderTotal(totalKind, kindTxt) {
    const { productsData, onChangeProductsData } = this.props;
    return Object.keys(totalKind).map(currency => (
      <ProductTotal
        key={kindTxt.concat(currency)}
        totalKind={totalKind[currency]}
        kindTxt={kindTxt}
        currency={currency}
        productsData={productsData}
        updateTotal={this.updateTotal}
        onChangeProductsData={onChangeProductsData}
      />
    ));
  }

  renderContent() {
    const { productsData, onChangeProductsData, currentProduct } = this.props;

    if (productsData.length === 0) {
      return (
        <EmptyState size="full" text="No product or services" icon="box" />
      );
    }

    return (
      <ProductTableWrapper>
        <Table>
          <thead>
            <tr>
              <th>{__('Product / Service')}</th>
              <th>{__('Quantity')}</th>
              <th>{__('Unit price')}</th>
              <th>{__('Discount')}</th>
              <th>{__('Tax')}</th>
              <th>{__('Amount')}</th>
              <th />
            </tr>
          </thead>
          <tbody id="products">
            {productsData.map(productData => (
              <ProductItem
                key={productData._id}
                productData={productData}
                removeProductItem={this.removeProductItem}
                productsData={productsData}
                onChangeProductsData={onChangeProductsData}
                updateTotal={this.updateTotal}
                uom={this.props.uom}
                currencies={this.props.currencies}
                currentProduct={currentProduct}
              />
            ))}
          </tbody>
        </Table>
      </ProductTableWrapper>
    );
  }

  calcChangePay = () => {
    const { paymentsData } = this.props;
    const { total } = this.state;

    const changePayData = Object.assign({}, total);
    const payments = paymentsData || {};

    Object.keys(payments || {}).forEach(key => {
      const perPaid = payments[key];
      const currency = perPaid.currency || '';

      if (Object.keys(changePayData).includes(currency)) {
        changePayData[currency] =
          changePayData[currency] - (perPaid.amount || 0);
      } else {
        if (perPaid.currency && perPaid.amount) {
          changePayData[currency] = -(perPaid.amount || 0);
        }
      }
    });

    this.setState({ changePayData });
  };

  onClick = () => {
    const { saveProductsData, productsData, closeModal } = this.props;

    const { total, changePayData } = this.state;

    if (productsData.length !== 0) {
      for (const data of productsData) {
        if (!data.product) {
          return Alert.error('Please choose a product');
        }

        if (!data.unitPrice && data.unitPrice !== 0) {
          return Alert.error(
            'Please enter an unit price. It should be a number'
          );
        }

        if (!data.currency) {
          return Alert.error('Please choose a currency');
        }
      }
    }

    if (
      Object.keys(total).length > 0 &&
      Object.keys(changePayData).length > 0
    ) {
      let alertMsg = '';
      for (const key of Object.keys(changePayData)) {
        // warning greater pay
        if (changePayData[key] > 0) {
          alertMsg =
            alertMsg + `Greater than total: ${changePayData[key]} ${key},`;
        }

        // warning less pay
        if (changePayData[key] < 0) {
          alertMsg =
            alertMsg + `Less than total: ${changePayData[key]} ${key},`;
        }
      }

      if (alertMsg) {
        Alert.warning('Change payment has problem: (' + alertMsg + ')');
      }
    }

    saveProductsData();
    closeModal();
  };

  renderTabContent() {
    const { total, tax, discount, currentTab } = this.state;
    const productTemplates = this.props.productTemplates || [];

    if (currentTab === 'payments') {
      const { onChangePaymentsData } = this.props;

      return (
        <PaymentForm
          total={total}
          payments={this.props.paymentsData}
          onChangePaymentsData={onChangePaymentsData}
          currencies={this.props.currencies}
          calcChangePay={this.calcChangePay}
          changePayData={this.state.changePayData}
        />
      );
    }

    const comboProductTemplate: any[] = [{ value: '', label: '' }];
    productTemplates.forEach(productTemplate => {
      comboProductTemplate.push({
        value: productTemplate._id,
        label: productTemplate.title
      });
    });

    return (
      <FormContainer>
        {this.renderContent()}
        <Add>
          <FormWrapper>
            <FormColumn>
              <Button
                btnStyle="primary"
                onClick={this.addProductItem}
                icon="plus-circle"
              >
                Add Product / Service
              </Button>
            </FormColumn>
            <FormColumn>
              <Dropdown>
                <Dropdown.Toggle as={DropdownToggle} id="dropdown-properties">
                  <Button btnStyle="primary">
                    {__('Add new template')}
                    <Icon icon="angle-down" />
                  </Button>
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  {comboProductTemplate.map(e => {
                    return (
                      <li
                        style={{
                          margin: '5px',
                          borderBottom: '0.5px',
                          cursor: 'pointer'
                        }}
                        key={Math.random()}
                        onClick={this.addProductTemplate.bind(this, e.value)}
                      >
                        {e.label}
                      </li>
                    );
                  })}
                </Dropdown.Menu>
              </Dropdown>
            </FormColumn>
          </FormWrapper>
        </Add>

        <FooterInfo>
          <table>
            <tbody>
              <tr>
                <td>{__('Discount')}:</td>
                <td>{this.renderTotal(discount, 'discount')}</td>
              </tr>
              <tr>
                <td>{__('Tax')}:</td>
                <td>{this.renderTotal(tax, 'tax')}</td>
              </tr>
              <tr>
                <td>{__('Total')}:</td>
                <td>{this.renderTotal(total, 'total')}</td>
              </tr>
            </tbody>
          </table>
        </FooterInfo>
      </FormContainer>
    );
  }

  onTabClick = (currentTab: string) => {
    this.setState({ currentTab });
  };

  render() {
    const { currentTab } = this.state;
    const trigger = (
      <div style={{ marginLeft: '15px', cursor: 'pointer' }}>
        Save as template
      </div>
    );
    const productsData = this.props.productsData || [];
    const templateItems = [] as any[];

    productsData.map(data => {
      return templateItems.push({
        _id: data._id,
        categoryId: data.product ? data.product.categoryId : '',
        itemId: data.product ? data.product._id : '',
        unitPrice: data.unitPrice,
        quantity: data.quantity,
        discount: data.discountPercent
      });
    });

    const currency = this.props.currencies ? this.props.currencies[0] : '';
    const grandDiscount = this.state.discount;
    const grandTotal = this.state.total;
    const discountValue =
      grandDiscount[currency] && grandDiscount[currency].percent
        ? grandDiscount[currency].percent || 0
        : 0;
    const totalValue = grandTotal[currency] ? grandTotal[currency] : 0;
    const productTemplate = {
      discount: Number(discountValue.toFixed(3)),
      totalAmount: totalValue,
      templateItems
    };
    const content = props => (
      <TemplateForm {...props} items={productTemplate} />
    );

    return (
      <>
        <Tabs grayBorder={true} full={true}>
          <TabTitle
            className={currentTab === 'products' ? 'active' : ''}
            onClick={this.onTabClick.bind(this, 'products')}
          >
            <Icon icon="box" />
            {__('Products')}
          </TabTitle>
          <TabTitle
            className={currentTab === 'payments' ? 'active' : ''}
            onClick={this.onTabClick.bind(this, 'payments')}
          >
            <Icon icon="atm-card" />
            {__('Payments')}
          </TabTitle>
        </Tabs>

        {this.renderTabContent()}

        <ModalFooter>
          {this.state.saveAsTemplateStatus && (
            <Button btnStyle="simple">
              <ModalTrigger
                title="Save as Template"
                trigger={trigger}
                size="lg"
                content={content}
              />
            </Button>
          )}
          <Button
            btnStyle="simple"
            onClick={this.props.closeModal}
            icon="times-circle"
          >
            Cancel
          </Button>

          <Button btnStyle="success" onClick={this.onClick} icon="check-circle">
            Save
          </Button>
        </ModalFooter>
      </>
    );
  }
}

export default ProductForm;
