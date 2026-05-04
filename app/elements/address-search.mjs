export default function addressSearch ({ html }) {
  return html`
<style>
  .address-search {
    position: relative;
    width: 100dvw;
    padding: 8px;
    box-sizing: border-box;
  }

  .address-search form {
    position: relative;
    margin: 0;
  }

  .address-search input {
    width: 100%;
    height: 40px;
    padding: 0 40px 0 12px;
    box-sizing: border-box;
    background-color: #ffffff;
    color: #111111;
    border: 1px solid #cccccc;
    border-radius: 9999px;
    font: inherit;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .address-search input::placeholder {
    color: #888888;
  }

  .address-search button.search-submit {
    position: absolute;
    top: 50%;
    right: 6px;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: transparent;
    color: #444444;
    border: 0;
    cursor: pointer;
  }

  .address-search button.search-submit:hover {
    color: #111111;
  }

  .address-search svg {
    width: 20px;
    height: 20px;
  }
</style>

<div class="address-search">
  <form action="/address" method="POST">
    <input name="search_address" type="text" id="find_location" placeholder="Search address" autocomplete="off">
    <button type="submit" class="search-submit" aria-label="Search">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    </button>
  </form>
</div>
  `
}
