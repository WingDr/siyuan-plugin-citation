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

import {
    IKeyboardStatus,
    IMouseStatus,
    ITypeStatus,
} from ".";

/* 判断是否为预期的键盘事件 */
export function isMatchedKeyboardEvent(e: KeyboardEvent, status: IKeyboardStatus) {
    return e.key === status.key
        && e.type === status.type
        && e.altKey === status.altKey
        && e.ctrlKey === status.ctrlKey
        && e.metaKey === status.metaKey
        && e.shiftKey === status.shiftKey;
}

/* 判断是否为预期的鼠标事件 */
export function isMatchedMouseEvent(e: MouseEvent, status: IMouseStatus) {
    return e.button === status.button
        && e.type === status.type
        && e.altKey === status.altKey
        && e.ctrlKey === status.ctrlKey
        && e.metaKey === status.metaKey
        && e.shiftKey === status.shiftKey;
}

/* 判断是否为预期的类型事件 */
export function isMatchedTypeEvent(e: KeyboardEvent | MouseEvent, status: ITypeStatus) {
    return e.type === status.type
        && e.altKey === status.altKey
        && e.ctrlKey === status.ctrlKey
        && e.metaKey === status.metaKey
        && e.shiftKey === status.shiftKey;
}
