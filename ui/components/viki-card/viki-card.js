import { BaseComponent } from '../base/base.js';

export class VikiCard extends BaseComponent {
    constructor() {
        super('viki-card');
    }
}

customElements.define('viki-card', VikiCard);
