/**
 * Copyright (C) 2023 Zuoqiu Yingyi
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * 鼠标按钮定义
 * REF: [MouseEvent.button - Web API 接口参考 | MDN](https://developer.mozilla.org/zh-CN/docs/Web/API/MouseEvent/button)
 */
export enum MouseButton {
    Left = 0,
    Middle = 1,
    Right = 2,
    Back = 3,
    Forward = 4,
}

export enum MouseEvent {
    click = "click",
    dblclick = "dblclick",

    contextmenu = "contextmenu",

    mousedown = "mousedown",
    mouseup = "mouseup",

    mouseenter = "mouseenter",
    mouseleave = "mouseleave",

    mousewheel = "mousewheel",
    mouseover = "mouseover",
    mousemove = "mousemove",
    mouseout = "mouseout",
}

/**
 * 功能键状态
 * REF: [Event - Web API 接口参考 | MDN](https://developer.mozilla.org/zh-CN/docs/Web/API/Event)
 */
export interface IFunctionKeysStatus {
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
}

/* 事件类型状态 */
export interface ITypeStatus extends IFunctionKeysStatus {
    // REF [event.type - Web API 接口参考 | MDN](https://developer.mozilla.org/zh-CN/docs/Web/API/Event/type)
    type: string;
}

/**
 * 键盘状态
 * REF: [KeyboardEvent - Web API 接口参考 | MDN](https://developer.mozilla.org/zh-CN/docs/Web/API/KeyboardEvent)
 */
export interface IKeyboardStatus extends ITypeStatus {
    // REF [KeyboardEvent.key - Web API 接口参考 | MDN](https://developer.mozilla.org/zh-CN/docs/Web/API/KeyboardEvent/key)
    key: string;
}

/**
 * 鼠标状态
 * REF: [鼠标事件 - Web API 接口参考 | MDN](https://developer.mozilla.org/zh-CN/docs/Web/API/MouseEvent)
 */
export interface IMouseStatus extends ITypeStatus {
    // REF [MouseEvent.button - Web API 接口参考 | MDN](https://developer.mozilla.org/zh-CN/docs/Web/API/MouseEvent/button)
    button: MouseButton;
}
