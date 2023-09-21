export default function addressSearch({html,state}){
  return html`
<style>

.address-search {
  position: relative;
  width: 100dvw;
  height: 10dvh;
}
.address-search input{
  top: 5dvw;
  left: 5dvw;
  position: absolute;
  width: 90dvw;
  height: 5dvh
}
.address-search svg {
  position: absolute;
  right: 10dvw;
  top: 50%;
  transform: translateY(-50%);
}

</style>


<div class="address-search">
  <form action="/address" method="POST">
    <input class="p-1 border1 border-solid radius-pill border-current " name="search_address" type="text" id="find_location" placeholder="address">
    <svg width=24 height=24 xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  </form>
</div>
  `
}
