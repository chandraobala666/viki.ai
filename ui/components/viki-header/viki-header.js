import { BaseComponent } from '../base/base.js';

export class VikiHeader extends BaseComponent {
    constructor() {
        super('viki-header');
    }
}

customElements.define('viki-header', VikiHeader);