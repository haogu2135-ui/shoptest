package com.example.shop.repository;

import org.junit.jupiter.api.Test;
import org.w3c.dom.Document;

import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.xpath.XPathConstants;
import javax.xml.xpath.XPathFactory;
import org.xml.sax.InputSource;

import java.io.StringReader;
import java.lang.reflect.Method;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CustomerOwnedMapperLimitContractTest {

    @Test
    void wishlistAndPetProfileFindByUserIdRequireExplicitLimits() throws Exception {
        assertFindByUserIdRequiresLimit(WishlistMapper.class);
        assertFindByUserIdRequiresLimit(PetProfileMapper.class);
    }

    @Test
    void wishlistAndPetProfileFindByUserIdSqlAppliesLimitParameter() throws Exception {
        assertFindByUserIdSqlAppliesLimit("WishlistMapper.xml");
        assertFindByUserIdSqlAppliesLimit("PetProfileMapper.xml");
    }

    private void assertFindByUserIdRequiresLimit(Class<?> mapper) throws Exception {
        Method method = mapper.getMethod("findByUserId", Long.class, int.class);

        assertEquals(List.class, method.getReturnType());
        assertFalse(Arrays.stream(mapper.getMethods())
                        .anyMatch(candidate -> "findByUserId".equals(candidate.getName())
                                && candidate.getParameterCount() == 1),
                mapper.getSimpleName() + " must not expose an unbounded findByUserId overload");
    }

    private void assertFindByUserIdSqlAppliesLimit(String mapperFileName) throws Exception {
        String sql = selectSql(mapperFileName, "findByUserId");

        assertTrue(sql.contains("LIMIT #{limit}"),
                mapperFileName + " findByUserId must apply the caller-provided row limit");
    }

    private String selectSql(String mapperFileName, String selectId) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", false);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setXIncludeAware(false);
        factory.setExpandEntityReferences(false);
        var builder = factory.newDocumentBuilder();
        builder.setEntityResolver((publicId, systemId) -> new InputSource(new StringReader("")));
        Document document = builder.parse(Path.of("src/main/resources/mapper", mapperFileName).toFile());
        String xpath = "string(/mapper/select[@id='" + selectId + "'])";
        String sql = (String) XPathFactory.newInstance().newXPath()
                .evaluate(xpath, document, XPathConstants.STRING);
        return sql.replaceAll("\\s+", " ").trim();
    }
}
