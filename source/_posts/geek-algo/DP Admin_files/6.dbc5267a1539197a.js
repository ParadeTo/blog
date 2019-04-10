(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[6],{

/***/ "./node_modules/css-loader/index.js?!./node_modules/postcss-loader/src/index.js!./node_modules/less-loader/dist/cjs.js?!./src/components/Common/SearchForm/index.less":
/*!****************************************************************************************************************************************************************************!*\
  !*** ./node_modules/css-loader??ref--8-1!./node_modules/postcss-loader/src!./node_modules/less-loader/dist/cjs.js??ref--8-3!./src/components/Common/SearchForm/index.less ***!
  \****************************************************************************************************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports = module.exports = __webpack_require__(/*! ../../../../node_modules/css-loader/lib/css-base.js */ "./node_modules/css-loader/lib/css-base.js")(false);
// imports


// module
exports.push([module.i, "/* stylelint-disable at-rule-empty-line-before,at-rule-name-space-after,at-rule-no-unknown */\n/* stylelint-disable no-duplicate-selectors */\n/* stylelint-disable declaration-bang-space-before,no-duplicate-selectors */\n/* stylelint-disable declaration-bang-space-before,no-duplicate-selectors,string-no-newline */\n.tableList__78006aa .tableListOperator__5404f80 {\n  margin-bottom: 16px;\n}\n.tableList__78006aa .tableListOperator__5404f80 button {\n  margin-right: 8px;\n}\n.tableListForm__c3b36d3 .ant-form-item {\n  margin-bottom: 24px;\n  margin-right: 0;\n  display: -webkit-box;\n  display: -ms-flexbox;\n  display: flex;\n}\n.tableListForm__c3b36d3 .ant-form-item > .ant-form-item-label {\n  width: auto;\n  line-height: 32px;\n  padding-right: 8px;\n}\n.tableListForm__c3b36d3 .ant-form-item .ant-form-item-control {\n  line-height: 32px;\n}\n.tableListForm__c3b36d3 .ant-form-item-control-wrapper {\n  -webkit-box-flex: 1;\n      -ms-flex: 1;\n          flex: 1;\n}\n.tableListForm__c3b36d3 .submitButtons__c88ca22 {\n  white-space: nowrap;\n  margin-bottom: 24px;\n}\n@media screen and (max-width: 992px) {\n  .tableListForm__c3b36d3 .ant-form-item {\n    margin-right: 24px;\n  }\n}\n@media screen and (max-width: 768px) {\n  .tableListForm__c3b36d3 .ant-form-item {\n    margin-right: 8px;\n  }\n}\n", ""]);

// exports
exports.locals = {
	"tableList": "tableList__78006aa",
	"tableListOperator": "tableListOperator__5404f80",
	"tableListForm": "tableListForm__c3b36d3",
	"submitButtons": "submitButtons__c88ca22"
};

/***/ }),

/***/ "./node_modules/css-loader/index.js?!./node_modules/postcss-loader/src/index.js!./node_modules/less-loader/dist/cjs.js?!./src/components/StandardTable/index.less":
/*!************************************************************************************************************************************************************************!*\
  !*** ./node_modules/css-loader??ref--8-1!./node_modules/postcss-loader/src!./node_modules/less-loader/dist/cjs.js??ref--8-3!./src/components/StandardTable/index.less ***!
  \************************************************************************************************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports = module.exports = __webpack_require__(/*! ../../../node_modules/css-loader/lib/css-base.js */ "./node_modules/css-loader/lib/css-base.js")(false);
// imports


// module
exports.push([module.i, "/* stylelint-disable at-rule-empty-line-before,at-rule-name-space-after,at-rule-no-unknown */\n/* stylelint-disable no-duplicate-selectors */\n/* stylelint-disable declaration-bang-space-before,no-duplicate-selectors */\n/* stylelint-disable declaration-bang-space-before,no-duplicate-selectors,string-no-newline */\n.standardTable__11e0128 .ant-table-pagination {\n  margin-top: 24px;\n}\n.standardTable__11e0128 .tableAlert__4f6ac01 {\n  margin-bottom: 16px;\n}\n", ""]);

// exports
exports.locals = {
	"standardTable": "standardTable__11e0128",
	"tableAlert": "tableAlert__4f6ac01"
};

/***/ }),

/***/ "./src/components/Common/SearchForm/index.js":
/*!***************************************************!*\
  !*** ./src/components/Common/SearchForm/index.js ***!
  \***************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _babel_runtime_helpers_objectSpread__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/objectSpread */ "./node_modules/@babel/runtime/helpers/objectSpread.js");
/* harmony import */ var _babel_runtime_helpers_objectSpread__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_objectSpread__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _babel_runtime_helpers_extends__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @babel/runtime/helpers/extends */ "./node_modules/@babel/runtime/helpers/extends.js");
/* harmony import */ var _babel_runtime_helpers_extends__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_extends__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _babel_runtime_helpers_typeof__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @babel/runtime/helpers/typeof */ "./node_modules/@babel/runtime/helpers/typeof.js");
/* harmony import */ var _babel_runtime_helpers_typeof__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_typeof__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @babel/runtime/helpers/classCallCheck */ "./node_modules/@babel/runtime/helpers/classCallCheck.js");
/* harmony import */ var _babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _babel_runtime_helpers_createClass__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @babel/runtime/helpers/createClass */ "./node_modules/@babel/runtime/helpers/createClass.js");
/* harmony import */ var _babel_runtime_helpers_createClass__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_createClass__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var _babel_runtime_helpers_possibleConstructorReturn__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @babel/runtime/helpers/possibleConstructorReturn */ "./node_modules/@babel/runtime/helpers/possibleConstructorReturn.js");
/* harmony import */ var _babel_runtime_helpers_possibleConstructorReturn__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_possibleConstructorReturn__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var _babel_runtime_helpers_getPrototypeOf__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @babel/runtime/helpers/getPrototypeOf */ "./node_modules/@babel/runtime/helpers/getPrototypeOf.js");
/* harmony import */ var _babel_runtime_helpers_getPrototypeOf__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_getPrototypeOf__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var _babel_runtime_helpers_inherits__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @babel/runtime/helpers/inherits */ "./node_modules/@babel/runtime/helpers/inherits.js");
/* harmony import */ var _babel_runtime_helpers_inherits__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_inherits__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var antd_lib_form_style_css__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! antd/lib/form/style/css */ "./node_modules/antd/lib/form/style/css.js");
/* harmony import */ var antd_lib_form_style_css__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(antd_lib_form_style_css__WEBPACK_IMPORTED_MODULE_8__);
/* harmony import */ var antd_lib_form__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! antd/lib/form */ "./node_modules/antd/lib/form/index.js");
/* harmony import */ var antd_lib_form__WEBPACK_IMPORTED_MODULE_9___default = /*#__PURE__*/__webpack_require__.n(antd_lib_form__WEBPACK_IMPORTED_MODULE_9__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! react */ "./node_modules/react/index.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_10___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_10__);
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! moment */ "./node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_11___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_11__);
/* harmony import */ var _utils_utils__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @utils/utils */ "./src/utils/utils.js");
/* harmony import */ var _const_index__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @const/index */ "./src/constants/index.js");
/* harmony import */ var _const_common__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @const/common */ "./src/constants/common.js");
/* harmony import */ var _helper_utils__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @helper/utils */ "./src/helpers/utils.js");
/* harmony import */ var _index_less__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ./index.less */ "./src/components/Common/SearchForm/index.less");
/* harmony import */ var _index_less__WEBPACK_IMPORTED_MODULE_16___default = /*#__PURE__*/__webpack_require__.n(_index_less__WEBPACK_IMPORTED_MODULE_16__);











var _dec, _class;








var priceConvertMap = ['final_price_min', 'final_price_max', 'market_price_min', 'market_price_max', 'refund_amount_min', 'refund_amount_max'];
var SearchForm = (_dec = antd_lib_form__WEBPACK_IMPORTED_MODULE_9___default.a.create(), _dec(_class =
/*#__PURE__*/
function (_React$Component) {
  _babel_runtime_helpers_inherits__WEBPACK_IMPORTED_MODULE_7___default()(SearchForm, _React$Component);

  function SearchForm(props) {
    var _this;

    _babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_3___default()(this, SearchForm);

    _this = _babel_runtime_helpers_possibleConstructorReturn__WEBPACK_IMPORTED_MODULE_5___default()(this, _babel_runtime_helpers_getPrototypeOf__WEBPACK_IMPORTED_MODULE_6___default()(SearchForm).call(this, props));

    _this.handleFormReset = function () {
      var form = _this.props.form;
      form.resetFields();
      Object(_utils_utils__WEBPACK_IMPORTED_MODULE_12__["clearSearchFilters"])();
      Object(_utils_utils__WEBPACK_IMPORTED_MODULE_12__["clearFormValues"])();

      _this.setState({
        formValues: {}
      }); // to do patch


      window.location.reload(); //  this.props.updateList(this.state.param)
    };

    _this.toggleForm = function () {
      var toggleForm = _this.props.toggleForm;
      var expandForm = _this.state.expandForm;

      _this.setState({
        expandForm: !expandForm
      }, function () {
        toggleForm && toggleForm(!expandForm);
      });
    };

    _this.handleSearch = function (e) {
      e.preventDefault();
      var form = _this.props.form;
      form.validateFields(function (err, fieldsValue) {
        if (err) return;

        for (var key in fieldsValue) {
          if (fieldsValue[key] && priceConvertMap.includes(key)) {
            fieldsValue[key] = fieldsValue[key] * _const_common__WEBPACK_IMPORTED_MODULE_14__["constantMap"].stampmultiply;
          } else if (fieldsValue[key] && _babel_runtime_helpers_typeof__WEBPACK_IMPORTED_MODULE_2___default()(fieldsValue[key]) === 'object' && moment__WEBPACK_IMPORTED_MODULE_11___default()().constructor === fieldsValue[key].constructor) {
            fieldsValue[key] = fieldsValue[key].valueOf();
          }
        }

        fieldsValue.create_time_min = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_12__["searchTimeParam"])(fieldsValue.create_time_min);
        fieldsValue.create_time_max = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_12__["searchTimeParam"])(fieldsValue.create_time_max);
        fieldsValue = Object(_helper_utils__WEBPACK_IMPORTED_MODULE_15__["dealObjectValue"])(fieldsValue);
        Object(_utils_utils__WEBPACK_IMPORTED_MODULE_12__["setFormValues"])(fieldsValue);
        fieldsValue = _babel_runtime_helpers_extends__WEBPACK_IMPORTED_MODULE_1___default()(fieldsValue, Object(_utils_utils__WEBPACK_IMPORTED_MODULE_12__["getFormFilters"])());

        var values = _babel_runtime_helpers_objectSpread__WEBPACK_IMPORTED_MODULE_0___default()({}, fieldsValue);

        _this.setState({
          formValues: values
        });

        _this.props.updateList(values);
      });
    };

    _this.state = {
      expandForm: false,
      formValues: {}
    };
    return _this;
  }

  _babel_runtime_helpers_createClass__WEBPACK_IMPORTED_MODULE_4___default()(SearchForm, [{
    key: "renderSimpleForm",
    value: function renderSimpleForm(curSimpleSearch, isNeedMoreSearch) {
      var getFieldDecorator = this.props.form.getFieldDecorator;
      var result = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_12__["createSearchFrom"])(curSimpleSearch || _const_index__WEBPACK_IMPORTED_MODULE_13__["simpleSearch"], getFieldDecorator, this.handleSearch, this.handleFormReset, this.toggleForm, isNeedMoreSearch);
      return result;
    }
  }, {
    key: "renderAdvancedForm",
    value: function renderAdvancedForm(curAdvanceSearch, isNeedMoreSearch) {
      var getFieldDecorator = this.props.form.getFieldDecorator;
      var result = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_12__["createSearchFrom"])(curAdvanceSearch, getFieldDecorator, this.handleSearch, this.handleFormReset, this.toggleForm, isNeedMoreSearch);
      return result;
    }
  }, {
    key: "renderForm",
    value: function renderForm(_ref) {
      var curAdvanceSearch = _ref.curAdvanceSearch,
          isNeedMoreSearch = _ref.isNeedMoreSearch,
          curSimpleSearch = _ref.curSimpleSearch;

      if (!curAdvanceSearch) {
        return this.renderSimpleForm(curSimpleSearch, isNeedMoreSearch);
      } else if (isNeedMoreSearch === false) {
        return this.renderAdvancedForm(curAdvanceSearch, isNeedMoreSearch);
      } else {
        return this.state.expandForm ? this.renderAdvancedForm(curAdvanceSearch) : this.renderSimpleForm(curSimpleSearch);
      }
    }
  }, {
    key: "render",
    value: function render() {
      var _this$props = this.props,
          curAdvanceSearch = _this$props.curAdvanceSearch,
          isNeedMoreSearch = _this$props.isNeedMoreSearch,
          curSimpleSearch = _this$props.curSimpleSearch;
      return react__WEBPACK_IMPORTED_MODULE_10___default.a.createElement("div", {
        className: _index_less__WEBPACK_IMPORTED_MODULE_16___default.a.tableList,
        id: "table-list"
      }, react__WEBPACK_IMPORTED_MODULE_10___default.a.createElement("div", {
        className: _index_less__WEBPACK_IMPORTED_MODULE_16___default.a.tableListForm
      }, this.renderForm({
        curAdvanceSearch: curAdvanceSearch,
        isNeedMoreSearch: isNeedMoreSearch,
        curSimpleSearch: curSimpleSearch
      })));
    }
  }]);

  return SearchForm;
}(react__WEBPACK_IMPORTED_MODULE_10___default.a.Component)) || _class);
/* harmony default export */ __webpack_exports__["default"] = (SearchForm);

/***/ }),

/***/ "./src/components/Common/SearchForm/index.less":
/*!*****************************************************!*\
  !*** ./src/components/Common/SearchForm/index.less ***!
  \*****************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {


var content = __webpack_require__(/*! !../../../../node_modules/css-loader??ref--8-1!../../../../node_modules/postcss-loader/src!../../../../node_modules/less-loader/dist/cjs.js??ref--8-3!./index.less */ "./node_modules/css-loader/index.js?!./node_modules/postcss-loader/src/index.js!./node_modules/less-loader/dist/cjs.js?!./src/components/Common/SearchForm/index.less");

if(typeof content === 'string') content = [[module.i, content, '']];

var transform;
var insertInto;



var options = {"hmr":true}

options.transform = transform
options.insertInto = undefined;

var update = __webpack_require__(/*! ../../../../node_modules/style-loader/lib/addStyles.js */ "./node_modules/style-loader/lib/addStyles.js")(content, options);

if(content.locals) module.exports = content.locals;

if(true) {
	module.hot.accept(/*! !../../../../node_modules/css-loader??ref--8-1!../../../../node_modules/postcss-loader/src!../../../../node_modules/less-loader/dist/cjs.js??ref--8-3!./index.less */ "./node_modules/css-loader/index.js?!./node_modules/postcss-loader/src/index.js!./node_modules/less-loader/dist/cjs.js?!./src/components/Common/SearchForm/index.less", function() {
		var newContent = __webpack_require__(/*! !../../../../node_modules/css-loader??ref--8-1!../../../../node_modules/postcss-loader/src!../../../../node_modules/less-loader/dist/cjs.js??ref--8-3!./index.less */ "./node_modules/css-loader/index.js?!./node_modules/postcss-loader/src/index.js!./node_modules/less-loader/dist/cjs.js?!./src/components/Common/SearchForm/index.less");

		if(typeof newContent === 'string') newContent = [[module.i, newContent, '']];

		var locals = (function(a, b) {
			var key, idx = 0;

			for(key in a) {
				if(!b || a[key] !== b[key]) return false;
				idx++;
			}

			for(key in b) idx--;

			return idx === 0;
		}(content.locals, newContent.locals));

		if(!locals) throw new Error('Aborting CSS HMR due to changed css-modules locals.');

		update(newContent);
	});

	module.hot.dispose(function() { update(); });
}

/***/ }),

/***/ "./src/components/Common/TableForm/index.js":
/*!**************************************************!*\
  !*** ./src/components/Common/TableForm/index.js ***!
  \**************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return TableForm; });
/* harmony import */ var _babel_runtime_helpers_objectSpread__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/objectSpread */ "./node_modules/@babel/runtime/helpers/objectSpread.js");
/* harmony import */ var _babel_runtime_helpers_objectSpread__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_objectSpread__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @babel/runtime/helpers/classCallCheck */ "./node_modules/@babel/runtime/helpers/classCallCheck.js");
/* harmony import */ var _babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _babel_runtime_helpers_createClass__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @babel/runtime/helpers/createClass */ "./node_modules/@babel/runtime/helpers/createClass.js");
/* harmony import */ var _babel_runtime_helpers_createClass__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_createClass__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _babel_runtime_helpers_possibleConstructorReturn__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @babel/runtime/helpers/possibleConstructorReturn */ "./node_modules/@babel/runtime/helpers/possibleConstructorReturn.js");
/* harmony import */ var _babel_runtime_helpers_possibleConstructorReturn__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_possibleConstructorReturn__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _babel_runtime_helpers_getPrototypeOf__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @babel/runtime/helpers/getPrototypeOf */ "./node_modules/@babel/runtime/helpers/getPrototypeOf.js");
/* harmony import */ var _babel_runtime_helpers_getPrototypeOf__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_getPrototypeOf__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var _babel_runtime_helpers_inherits__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @babel/runtime/helpers/inherits */ "./node_modules/@babel/runtime/helpers/inherits.js");
/* harmony import */ var _babel_runtime_helpers_inherits__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_inherits__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! react */ "./node_modules/react/index.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var _comp_StandardTable__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @comp/StandardTable */ "./src/components/StandardTable/index.js");
/* harmony import */ var _utils_utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @utils/utils */ "./src/utils/utils.js");










var TableForm =
/*#__PURE__*/
function (_React$Component) {
  _babel_runtime_helpers_inherits__WEBPACK_IMPORTED_MODULE_5___default()(TableForm, _React$Component);

  function TableForm() {
    var _getPrototypeOf2;

    var _this;

    _babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_1___default()(this, TableForm);

    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    _this = _babel_runtime_helpers_possibleConstructorReturn__WEBPACK_IMPORTED_MODULE_3___default()(this, (_getPrototypeOf2 = _babel_runtime_helpers_getPrototypeOf__WEBPACK_IMPORTED_MODULE_4___default()(TableForm)).call.apply(_getPrototypeOf2, [this].concat(args)));

    _this.handleStandardTableChange = function (pagination, filtersArg) {
      var formValues = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_8__["getFormValues"])();
      var filters = Object.keys(filtersArg).reduce(function (obj, key) {
        var newObj = _babel_runtime_helpers_objectSpread__WEBPACK_IMPORTED_MODULE_0___default()({}, obj);

        newObj[key] = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_8__["getValue"])(filtersArg[key]);
        return newObj;
      }, {});
      Object(_utils_utils__WEBPACK_IMPORTED_MODULE_8__["setFormFilters"])(filters);

      var params = _babel_runtime_helpers_objectSpread__WEBPACK_IMPORTED_MODULE_0___default()({}, formValues, {
        page: pagination.current,
        page_size: pagination.pageSize
      }, filters);

      _this.props.updateList(params);
    };

    return _this;
  }

  _babel_runtime_helpers_createClass__WEBPACK_IMPORTED_MODULE_2___default()(TableForm, [{
    key: "render",
    value: function render() {
      var _this$props = this.props,
          columns = _this$props.columns,
          data = _this$props.data,
          loading = _this$props.loading,
          scroll = _this$props.scroll,
          footer = _this$props.footer,
          rowSelection = _this$props.rowSelection,
          rowKey = _this$props.rowKey;
      return react__WEBPACK_IMPORTED_MODULE_6___default.a.createElement(_comp_StandardTable__WEBPACK_IMPORTED_MODULE_7__["default"], {
        rowSelection: rowSelection,
        scroll: scroll || {},
        loading: loading,
        data: data,
        columns: columns,
        onChange: this.handleStandardTableChange,
        rowKey: rowKey,
        footer: footer
      });
    }
  }]);

  return TableForm;
}(react__WEBPACK_IMPORTED_MODULE_6___default.a.Component);



/***/ }),

/***/ "./src/components/StandardTable/index.js":
/*!***********************************************!*\
  !*** ./src/components/StandardTable/index.js ***!
  \***********************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var antd_lib_table_style_css__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! antd/lib/table/style/css */ "./node_modules/antd/lib/table/style/css.js");
/* harmony import */ var antd_lib_table_style_css__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(antd_lib_table_style_css__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var antd_lib_table__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! antd/lib/table */ "./node_modules/antd/lib/table/index.js");
/* harmony import */ var antd_lib_table__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(antd_lib_table__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _babel_runtime_helpers_objectSpread__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @babel/runtime/helpers/objectSpread */ "./node_modules/@babel/runtime/helpers/objectSpread.js");
/* harmony import */ var _babel_runtime_helpers_objectSpread__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_objectSpread__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @babel/runtime/helpers/classCallCheck */ "./node_modules/@babel/runtime/helpers/classCallCheck.js");
/* harmony import */ var _babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _babel_runtime_helpers_createClass__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @babel/runtime/helpers/createClass */ "./node_modules/@babel/runtime/helpers/createClass.js");
/* harmony import */ var _babel_runtime_helpers_createClass__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_createClass__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var _babel_runtime_helpers_possibleConstructorReturn__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @babel/runtime/helpers/possibleConstructorReturn */ "./node_modules/@babel/runtime/helpers/possibleConstructorReturn.js");
/* harmony import */ var _babel_runtime_helpers_possibleConstructorReturn__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_possibleConstructorReturn__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var _babel_runtime_helpers_getPrototypeOf__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @babel/runtime/helpers/getPrototypeOf */ "./node_modules/@babel/runtime/helpers/getPrototypeOf.js");
/* harmony import */ var _babel_runtime_helpers_getPrototypeOf__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_getPrototypeOf__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var _babel_runtime_helpers_inherits__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @babel/runtime/helpers/inherits */ "./node_modules/@babel/runtime/helpers/inherits.js");
/* harmony import */ var _babel_runtime_helpers_inherits__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_inherits__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! react */ "./node_modules/react/index.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_8__);
/* harmony import */ var _index_less__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./index.less */ "./src/components/StandardTable/index.less");
/* harmony import */ var _index_less__WEBPACK_IMPORTED_MODULE_9___default = /*#__PURE__*/__webpack_require__.n(_index_less__WEBPACK_IMPORTED_MODULE_9__);











var StandardTable =
/*#__PURE__*/
function (_PureComponent) {
  _babel_runtime_helpers_inherits__WEBPACK_IMPORTED_MODULE_7___default()(StandardTable, _PureComponent);

  function StandardTable() {
    var _getPrototypeOf2;

    var _this;

    _babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_3___default()(this, StandardTable);

    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    _this = _babel_runtime_helpers_possibleConstructorReturn__WEBPACK_IMPORTED_MODULE_5___default()(this, (_getPrototypeOf2 = _babel_runtime_helpers_getPrototypeOf__WEBPACK_IMPORTED_MODULE_6___default()(StandardTable)).call.apply(_getPrototypeOf2, [this].concat(args)));

    _this.handleTableChange = function (pagination, filters, sorter) {
      _this.props.onChange(pagination, filters, sorter);
    };

    _this.cleanSelectedKeys = function () {
      _this.handleRowSelectChange([], []);
    };

    return _this;
  }

  _babel_runtime_helpers_createClass__WEBPACK_IMPORTED_MODULE_4___default()(StandardTable, [{
    key: "render",
    value: function render() {
      var _this$props = this.props,
          rowSelection = _this$props.rowSelection,
          _this$props$data = _this$props.data,
          list = _this$props$data.list,
          pagination = _this$props$data.pagination,
          loading = _this$props.loading,
          columns = _this$props.columns,
          rowKey = _this$props.rowKey,
          scroll = _this$props.scroll,
          footer = _this$props.footer;

      var paginationProps = _babel_runtime_helpers_objectSpread__WEBPACK_IMPORTED_MODULE_2___default()({
        showQuickJumper: true
      }, pagination);

      return react__WEBPACK_IMPORTED_MODULE_8___default.a.createElement("div", {
        className: _index_less__WEBPACK_IMPORTED_MODULE_9___default.a.standardTable
      }, react__WEBPACK_IMPORTED_MODULE_8___default.a.createElement(antd_lib_table__WEBPACK_IMPORTED_MODULE_1___default.a, {
        key: "table",
        rowSelection: rowSelection,
        scroll: scroll || {},
        loading: loading,
        rowKey: rowKey || function (record) {
          return record.order_id;
        },
        dataSource: list,
        columns: columns,
        pagination: paginationProps,
        onChange: this.handleTableChange,
        footer: footer
      }));
    }
  }]);

  return StandardTable;
}(react__WEBPACK_IMPORTED_MODULE_8__["PureComponent"]);

/* harmony default export */ __webpack_exports__["default"] = (StandardTable);

/***/ }),

/***/ "./src/components/StandardTable/index.less":
/*!*************************************************!*\
  !*** ./src/components/StandardTable/index.less ***!
  \*************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {


var content = __webpack_require__(/*! !../../../node_modules/css-loader??ref--8-1!../../../node_modules/postcss-loader/src!../../../node_modules/less-loader/dist/cjs.js??ref--8-3!./index.less */ "./node_modules/css-loader/index.js?!./node_modules/postcss-loader/src/index.js!./node_modules/less-loader/dist/cjs.js?!./src/components/StandardTable/index.less");

if(typeof content === 'string') content = [[module.i, content, '']];

var transform;
var insertInto;



var options = {"hmr":true}

options.transform = transform
options.insertInto = undefined;

var update = __webpack_require__(/*! ../../../node_modules/style-loader/lib/addStyles.js */ "./node_modules/style-loader/lib/addStyles.js")(content, options);

if(content.locals) module.exports = content.locals;

if(true) {
	module.hot.accept(/*! !../../../node_modules/css-loader??ref--8-1!../../../node_modules/postcss-loader/src!../../../node_modules/less-loader/dist/cjs.js??ref--8-3!./index.less */ "./node_modules/css-loader/index.js?!./node_modules/postcss-loader/src/index.js!./node_modules/less-loader/dist/cjs.js?!./src/components/StandardTable/index.less", function() {
		var newContent = __webpack_require__(/*! !../../../node_modules/css-loader??ref--8-1!../../../node_modules/postcss-loader/src!../../../node_modules/less-loader/dist/cjs.js??ref--8-3!./index.less */ "./node_modules/css-loader/index.js?!./node_modules/postcss-loader/src/index.js!./node_modules/less-loader/dist/cjs.js?!./src/components/StandardTable/index.less");

		if(typeof newContent === 'string') newContent = [[module.i, newContent, '']];

		var locals = (function(a, b) {
			var key, idx = 0;

			for(key in a) {
				if(!b || a[key] !== b[key]) return false;
				idx++;
			}

			for(key in b) idx--;

			return idx === 0;
		}(content.locals, newContent.locals));

		if(!locals) throw new Error('Aborting CSS HMR due to changed css-modules locals.');

		update(newContent);
	});

	module.hot.dispose(function() { update(); });
}

/***/ })

}]);
//# sourceMappingURL=6.dbc5267a1539197a.js.map