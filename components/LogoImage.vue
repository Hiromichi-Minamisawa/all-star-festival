<template lang="pug">
div.logo-container
  img.logo(src="@/assets/img/logo.jpg" alt="Logo")
</template>

<script>
export default {
  name: 'LogoImage'
}
</script>

<style scoped>
.logo-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.logo {
  max-width: 200px;
  height: auto;
}
</style>
