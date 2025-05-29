import { BaseComponent } from '../base/base.js';

export class VikiHeader extends BaseComponent {
    constructor() {
        super('viki-header');
    }

   connectedCallback() {
        super.connectedCallback();
    }
}

customElements.define('viki-header', VikiHeader);