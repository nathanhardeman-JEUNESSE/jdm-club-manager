async function chargerProduits() {

    try {

        const reponse = await fetch("../data/produits.json");

        const produits = await reponse.json();

        console.log(produits);

        return produits;

    }

    catch(erreur){

        console.error("Impossible de charger les produits :", erreur);

        return [];

    }

}