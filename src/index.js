/*
 * @Author: xiaochan
 * @Date: 2019-03-06 20:52:57
 * @Last Modified by: xiaochan
 * @Last Modified time: 2019-03-17 11:19:40
 *
 * render React Component to html
 * but don't create virtual dom, is faster than renderToStaticMarkup
 */
import React from 'react';
import {
    isReactComponent,
    escape,
    camelToKebab,
    validateValueForDomAttr,
    validateValueForSelfDefineAttr
} from './utils';
import {
    domAttrs,
    emptyTags,
    filterAttrs
} from './consts';

const oldH = React.createElement;

const convertStyleAttr = (value) => {
    let styleStr = '';
    for (let cssProperty in value) {
        styleStr += camelToKebab(cssProperty) + ':' + value[cssProperty] + ';';
    }
    return styleStr;
};

const joinDomAttr = (key, value) => ' ' + key + '="' + value + '"';

const getStaticMarkupAttrStr = (attrs) => {
    let attrStr = '';
    for (let key in attrs) {
        if (filterAttrs[key]) {
            continue;
        }
        const domAttr = domAttrs[key];
        const data = attrs[key];
        if (key === 'style' && data) {
            // 这里不使用typeof xxx === 'object'，babel会将其转化为_typeof函数
            let value = typeof data === 'string'
                ? convertStyleAttr(data)
                : data;
            attrStr += joinDomAttr(key, value);
            continue;
        }

        if (domAttr) { // dom attr
            if (validateValueForDomAttr(data)) {
                attrStr += joinDomAttr(domAttr, escape(data));
            }
        } else {  // 自定义attr
            if (validateValueForSelfDefineAttr(data)) {
                attrStr += joinDomAttr(key, escape(data));
            }
        }
    }
    return attrStr;
};

const hChildren = (children) => {
    const stack = children.reverse();
    let html = '';
    while (stack.length) {
        const child = stack.pop();
        // 经过h函数生成的html
        if (child && child.hasOwnProperty('html')) {
            html += child.html;
            continue;
        }

        // string
        if (typeof child === 'string') {
            // child有可能为用户自定义的纯string，如<li>{nameStr}</li>中的nameStr,需要进行转义
            html += escape(child);
            continue;
        }

        // array
        if  (child && child.push) {
            for (let i = child.length; i--;) {
                stack.push(child[i]);
            }
            continue;
        }

        // number
        if (typeof child === 'number') {
            html += child + '';
            continue;
        }

    }
    return html;
};

/**
 *  @return string | object
 * */
const h = function (type, attrs, ...children) {
    attrs = attrs || {};
    // dom element
    if (typeof type === 'string') {
        let html = '<' + type + getStaticMarkupAttrStr(attrs);
        if (!emptyTags[type]) {
            html += '>';
            if (attrs.hasOwnProperty('dangerouslySetInnerHTML')) {
                html += attrs.dangerouslySetInnerHTML.__html;
            }
            html += hChildren(children);
            html += '</' + type + '>';
        } else {
            html += '/>';
        }
        return { html };
    }

    // React.Fragment
    if (type === React.Fragment) {
        return { html: hChildren(children) };
    }

    // class component
    if (isReactComponent(type)) {
        const props = {
            ...(type.defaultProps || {}),
            ...attrs,
            children: children
        };
        const instance = new type(props);
        instance.props = props;
        // 这里不用forEach，性能低
        // ['componentWillMount', 'UNSAFE_componentWillMount'].forEach(hookName => instance.hasOwnProperty(hookName) && instance[hookName]());
        // life cycle hooks
        instance.componentWillMount && instance.componentWillMount();
        instance.UNSAFE_componentWillMount && instance.UNSAFE_componentWillMount();
        return instance.render();
    }

    // function component
    if (typeof type === 'function') {
        const props = {
            ...(type.defaultProps || {}),
            ...attrs,
            children: children
        };
        return type(props);
    }
};

export default function fastRenderToStaticMarkup (renderComponent) {
    React.createElement = h;
    const html = renderComponent();
    React.createElement = oldH;
    return html.hasOwnProperty('html') ? html.html : html;
}

export { h }