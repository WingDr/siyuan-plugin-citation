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

import type { IMouseStatus } from "../../utils/shortcut";
import type { TabKey } from "./tab";

export interface ITabEvent {
    changed: {
        key: TabKey;
    };
}

export interface IPanelsEvent {
    changed: {
        key: TabKey;
    };
    "search-changed": {
        value: string;
    };
}

export interface IShortcutEvent {
    changed: {
        shortcut: IMouseStatus;
    };
}

export interface IInputEvent {
    clicked: {
        event: MouseEvent;
    };
    changed: {
        key: string;
        value: any;
        event: Event;
    };
}
