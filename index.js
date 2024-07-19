const API = (() => {
    const URL = "http://localhost:3000";
    const ITEMS_PER_PAGE = 2; // Set to 2 items per page

    const getCart = () => fetch(`${URL}/cart`).then(res => res.json());

    const getInventory = (page = 1) => fetch(`${URL}/inventory?_page=${page}&_limit=${ITEMS_PER_PAGE}`)
        .then(res => res.json().then(items => ({ items, total: res.headers.get('X-Total-Count') })));

    const addToCart = (inventoryItem) => fetch(`${URL}/cart`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(inventoryItem)
    }).then(res => res.json());

    const updateCart = (id, newAmount) => fetch(`${URL}/cart/${id}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ quantity: newAmount })
    }).then(res => res.json());

    const deleteFromCart = (id) => fetch(`${URL}/cart/${id}`, {
        method: "DELETE"
    }).then(res => res.json());

    const checkout = () => getCart().then(data => Promise.all(data.map(item => deleteFromCart(item.id))));

    return {
        getCart,
        updateCart,
        getInventory,
        addToCart,
        deleteFromCart,
        checkout,
        ITEMS_PER_PAGE
    };
})();

const Model = (() => {
    class State {
        #onChange;
        #inventory;
        #cart;
        #currentPage;
        #totalPages;

        constructor() {
            this.#inventory = [];
            this.#cart = [];
            this.#currentPage = 1;
            this.#totalPages = 1;
        }

        get cart() {
            return this.#cart;
        }

        get inventory() {
            return this.#inventory;
        }

        get currentPage() {
            return this.#currentPage;
        }

        get totalPages() {
            return this.#totalPages;
        }

        set cart(newCart) {
            this.#cart = newCart;
            this.#onChange();
        }

        set inventory(newInventory) {
            this.#inventory = newInventory.items;
            this.#totalPages = Math.ceil(newInventory.total / API.ITEMS_PER_PAGE);
            this.#onChange();
        }

        set currentPage(newPage) {
            this.#currentPage = newPage;
            this.#onChange();
        }

        subscribe(cb) {
            this.#onChange = cb;
        }
    }

    const {
        getCart,
        updateCart,
        getInventory,
        addToCart,
        deleteFromCart,
        checkout
    } = API;

    return {
        State,
        getCart,
        updateCart,
        getInventory,
        addToCart,
        deleteFromCart,
        checkout
    };
})();

const View = (() => {
    const inventoryListEl = document.querySelector(".inventory-container ul");
    const cartListEl = document.querySelector(".cart-container ul");
    const checkoutBtnEl = document.querySelector(".checkout-btn");
    const prevBtnEl = document.querySelector(".prev-btn");
    const nextBtnEl = document.querySelector(".next-btn");
    const pageNumbersEl = document.querySelector(".pagination .page-info");

    const renderInventory = (inventory) => {
        inventoryListEl.innerHTML = "";
        inventory.forEach(item => {
            const itemEl = document.createElement("li");
            itemEl.innerHTML = `
                <span>${item.content}</span>
                <div>
                  <button class="minus-btn" data-id="${item.id}" type="button">-</button>
                  <input type="number" value="0" min="0" class="quantity-input" data-id="${item.id}">
                  <button class="plus-btn" data-id="${item.id}" type="button">+</button>
                  <button class="add-to-cart-btn" data-id="${item.id}" type="button">add to cart</button>
                </div>
            `;
            inventoryListEl.appendChild(itemEl);
        });
    };

    const renderCart = (cart) => {
        cartListEl.innerHTML = "";
        cart.forEach(item => {
            const itemEl = document.createElement("li");
            itemEl.innerHTML = `
                <span>${item.content} x ${item.quantity}</span>
                <button class="delete-btn" data-id="${item.id}" type="button">delete</button>
            `;
            cartListEl.appendChild(itemEl);
        });
    };

    const renderPagination = (currentPage, totalPages) => {
        prevBtnEl.disabled = currentPage === 1;
        nextBtnEl.disabled = currentPage === totalPages;
        pageNumbersEl.textContent = `Page ${currentPage} of ${totalPages}`;
    };

    return {
        renderInventory,
        renderCart,
        renderPagination,
        inventoryListEl,
        cartListEl,
        checkoutBtnEl,
        prevBtnEl,
        nextBtnEl,
        pageNumbersEl
    };
})();

const Controller = ((model, view) => {
    const state = new model.State();

    const handleUpdateAmount = () => {
        view.inventoryListEl.addEventListener("click", (event) => {
            if (event.target.classList.contains("plus-btn")) {
                event.preventDefault(); // Prevent default action
                const id = event.target.dataset.id;
                const quantityInput = document.querySelector(`.quantity-input[data-id='${id}']`);
                quantityInput.value = parseInt(quantityInput.value) + 1;
            }

            if (event.target.classList.contains("minus-btn")) {
                event.preventDefault(); // Prevent default action
                const id = event.target.dataset.id;
                const quantityInput = document.querySelector(`.quantity-input[data-id='${id}']`);
                if (parseInt(quantityInput.value) > 0) {
                    quantityInput.value = parseInt(quantityInput.value) - 1;
                }
            }
        });
    };

    const handleAddToCart = () => {
        view.inventoryListEl.addEventListener("click", (event) => {
            if (event.target.classList.contains("add-to-cart-btn")) {
                event.preventDefault(); // Prevent default action
                const id = event.target.dataset.id;
                const quantityInput = document.querySelector(`.quantity-input[data-id='${id}']`);
                let quantity = parseInt(quantityInput.value);
    
                if (quantity > 0) {
                    const inventoryItem = state.inventory.find(item => item.id == id);
                    const cartItem = state.cart.find(item => item.id == id);
    
                    if (cartItem) {
                        model.updateCart(id, cartItem.quantity + quantity)
                           .then(() => model.getCart())
                           .then(data => state.cart = data);
                    } else {
                        model.addToCart({...inventoryItem, quantity })
                           .then(() => model.getCart())
                           .then(data => state.cart = data);
                    }
                }
            }
        });
    };
      

    const handleDelete = () => {
        view.cartListEl.addEventListener("click", (event) => {
            if (event.target.classList.contains("delete-btn")) {
                event.preventDefault(); // Prevent default action
                const id = event.target.dataset.id;
                model.deleteFromCart(id).then(() => model.getCart()).then(data => state.cart = data);
            }
        });
    };

    const handleCheckout = () => {
        view.checkoutBtnEl.addEventListener("click", (event) => {
            event.preventDefault(); // Prevent default action
            model.checkout().then(() => model.getCart()).then(data => state.cart = data);
        });
    };

    const handlePagination = () => {
        view.prevBtnEl.addEventListener("click", (event) => {
            event.preventDefault(); // Prevent default action
            if (state.currentPage > 1) {
                state.currentPage -= 1;
                model.getInventory(state.currentPage).then(data => {
                    state.inventory = data;
                });
            }
        });

        view.nextBtnEl.addEventListener("click", (event) => {
            event.preventDefault(); // Prevent default action
            if (state.currentPage < state.totalPages) {
                state.currentPage += 1;
                model.getInventory(state.currentPage).then(data => {
                    state.inventory = data;
                });
            }
        });
    };

    const bootstrap = () => {
        state.subscribe(() => {
            view.renderInventory(state.inventory);
            view.renderCart(state.cart);
            view.renderPagination(state.currentPage, state.totalPages);
        });

        model.getInventory(state.currentPage).then(data => {
            state.inventory = data;
        });
        model.getCart().then(data => {
            state.cart = data;
        });

        handleUpdateAmount();
        handleAddToCart();
        handleDelete();
        handleCheckout();
        handlePagination();
    };

    return {
        bootstrap
    };
})(Model, View);

Controller.bootstrap();
